const { loadOpenCV } = require("./utils/loadOpenCV");
const { delay, Promise } = require("bluebird");
const puppeteer = require("puppeteer");
const PNG = require("pngjs").PNG;
const fs = require("fs");
const _ = require("lodash");

const ms = require("ms");

(async () => {
  await loadOpenCV();

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 780 },
    args: [
      `--disable-notifications=true`,
      "--window-position=1921,0",
      `--window-size=1920,1080`,
    ],
    // userDataDir: "~/desktop/puppeteer-data",
  });

  const page = await browser.newPage();
  await page.goto("https://cjslivelog.com/");

  // 页面截图
  const pageImgBuffer = await page.screenshot();
  const pageImgData = PNG.sync.read(pageImgBuffer);
  const pageSrc = cv.matFromImageData(pageImgData);

  // 读取所有目标元素图片样本
  const targetTemplatesPath = fs
    .readdirSync(__dirname + `/templates/`)
    .filter((item) => {
      const [name, suffix] = item.split(".");
      return suffix === "png";
    });

  let targetPositions = [];

  await Promise.each(targetTemplatesPath, async (fileName) => {
    const template = PNG.sync.read(
      fs.readFileSync(__dirname + `/templates/${fileName}`)
    );

    let templateSrc = cv.matFromImageData(template);

    let dst = new cv.Mat();
    let mask = new cv.Mat();

    // 进行匹配
    cv.matchTemplate(pageSrc, templateSrc, dst, cv.TM_CCOEFF_NORMED, mask);

    // 匹配上了，获取目标元素在图片上的坐标
    const result = cv.minMaxLoc(dst, mask);

    const maxPoint = result.maxLoc;
    const maxMatch = result.maxVal;

    console.log(fileName, maxMatch);

    // 标红
    await page.evaluate(
      ({ x, y, width, height }) => {
        // 创建一个元素
        const element = document.createElement("div");
        // 设置元素的定位
        element.style.position = "fixed";
        element.style.left = x + "px";
        element.style.top = y + "px";
        // 设置元素为红色方框，并添加样本名
        element.style.width = width + "px";
        element.style.height = height + "px";
        element.style.borderColor = "red";
        element.style.borderWidth = "2px";
        element.style.borderStyle = "solid";
        element.style.pointerEvents = "none";
        element.style.color = "red";
        // 添加元素到页面
        document.body.appendChild(element);
      },
      {
        x: maxPoint.x,
        y: maxPoint.y,
        width: template.width,
        height: template.height,
      }
    );

    // 清理资源
    dst.delete();
    mask.delete();
    templateSrc.delete();

    targetPositions.push({
      matchedNumber: maxMatch,
      position: maxPoint,
      fileName,
    });
  });

  // 找出匹配值最高的坐标
  const maxPointPosition = _.maxBy(targetPositions, "matchedNumber");

  // 等待 5 秒后点击匹配中的目标元素
  await delay(ms("5s"));

  await page.mouse.click(
    maxPointPosition.position.x + 1,
    maxPointPosition.position.y + 1
  );

  pageSrc.delete();

  await delay(ms("8h"));

  await browser.close();
})();
