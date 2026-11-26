import { describe, expect, it } from 'vitest';
import { circleFill } from '@/core/scene';
import { cameraForSheet, centerSheetCamera } from '@/modules/editor/lib/fitCamera';

describe('Камера листа и заливка круга', () => {
  it('центрирует новый A3 в доступной области при масштабе 100%', () => {
    const area = { x: 240, y: 80, width: 600, height: 480 };
    const sheet = { w: 11900, h: 8400 };
    const camera = centerSheetCamera(sheet, area);

    expect(camera.zoom).toBe(1);
    expect(camera.x + sheet.w / 2).toBe(540);
    expect(camera.y + sheet.h / 2).toBe(320);
    expect(cameraForSheet(sheet, area).zoom).toBeLessThan(1);
  });

  it('показывает прозрачность как фактическую заливку', () => {
    expect(circleFill({ bg: 'transparent' })).toBe('transparent');
  });

  it('сохраняет приоритет цвета в ранее созданных схемах', () => {
    expect(circleFill({ color: '#123456', bg: 'transparent' })).toBe('#123456');
  });
});
