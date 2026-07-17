import { resolveCorsOrigin } from './cors';

describe('resolveCorsOrigin', () => {
  it('uses the explicit allowlist khi có cấu hình', () => {
    const origins = ['https://app.example.com'];
    expect(resolveCorsOrigin('production', origins)).toBe(origins);
  });

  it('chỉ cho phép localhost ở non-production', () => {
    const origin = resolveCorsOrigin('development', []);
    expect(origin).toBeInstanceOf(RegExp);
    const re = origin as RegExp;
    expect(re.test('http://localhost:5174')).toBe(true);
    expect(re.test('http://127.0.0.1:3001')).toBe(true);
    expect(re.test('https://evil.example.com')).toBe(false);
  });

  it('fail closed (deny) ở production khi thiếu allowlist', () => {
    expect(resolveCorsOrigin('production', [])).toBe(false);
  });
});
