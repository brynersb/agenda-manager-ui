import { describe, expect, it } from 'vitest';

import { getLandingRoute } from './landing-route';

describe('getLandingRoute', () => {
  it('leva quem pode ler pautas para /content-briefs', () => {
    expect(getLandingRoute(['content-brief:read', 'content-brief:write'])).toBe(
      '/content-briefs',
    );
  });

  it('leva quem não tem nenhuma permissão para /no-permission', () => {
    expect(getLandingRoute([])).toBe('/no-permission');
  });

  it('leva para /no-permission quem só tem permissão que não abre tela', () => {
    expect(getLandingRoute(['registry:read'])).toBe('/no-permission');
  });
});
