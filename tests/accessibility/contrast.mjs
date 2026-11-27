import assert from 'node:assert/strict';

// axe может оставить цвет из CSS Color 4 для ручной проверки. На указанных в #29
// элементах дополнительно проверяем вычисленные браузером цвета и слои фона.
export async function checkContrast(locator, label) {
  await locator.waitFor();
  // Дождаться окончания transition после наведения или смены состояния.
  await locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  const contrast = await locator.evaluate((element) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const composite = ([r, g, b, alpha], background) => {
      const weight = alpha / 255;
      return [r, g, b].map((channel, index) => channel * weight + background[index] * (1 - weight));
    };
    const luminance = (color) => color.map((channel) => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      layers.push(rgba(getComputedStyle(node).backgroundColor));
    }
    const background = layers.reduceRight((color, layer) => composite(layer, color), [255, 255, 255]);
    const foreground = composite(rgba(getComputedStyle(element).color), background);
    const l1 = luminance(foreground);
    const l2 = luminance(background);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  });
  assert.ok(contrast >= 4.5, `${label}: контраст ${contrast.toFixed(2)}:1, требуется 4.5:1`);
}
