import request from 'supertest';
import express from 'express';

import {
  shopify,
  getExpectedOAuthBeginParams,
} from '../../__tests__/test-helper';
import {createAuthBegin} from '../auth-begin';

describe('beginAuth', () => {
  const app = express();
  app.get('/auth', async (req, res) => {
    await createAuthBegin({
      api: shopify.api,
      config: shopify.config,
    })(req, res);
  });

  it('triggers a server-side redirect with no params', async () => {
    const response = await request(app)
      .get('/auth?shop=my-shop.myshopify.io')
      .expect(302);

    const url = new URL(response.header.location);
    const params = Object.fromEntries(url.searchParams.entries());

    expect(url.host).toBe('my-shop.myshopify.io');
    expect(params).toMatchObject(getExpectedOAuthBeginParams(shopify.api));

    const cookieNames = response.header['set-cookie'].map(
      (cookie: string) => cookie.split('=')[0],
    );
    expect(cookieNames).toEqual(['shopify_app_state', 'shopify_app_state.sig']);
  });

  it('triggers a server-side redirect when embedded is not 1', async () => {
    const response = await request(app)
      .get('/auth?shop=my-shop.myshopify.io&embedded=0')
      .expect(302);

    const url = new URL(response.header.location);
    const params = Object.fromEntries(url.searchParams.entries());

    expect(url.host).toBe('my-shop.myshopify.io');
    expect(params).toMatchObject(getExpectedOAuthBeginParams(shopify.api));
  });

  it('triggers a client-side redirect when embedded is 1', async () => {
    const expectedParams = new URLSearchParams({
      shop: 'my-shop.myshopify.io',
      host: 'abc',
      embedded: '1',
    });
    const response = await request(app)
      .get(`/auth?${expectedParams.toString()}`)
      .expect(302);

    const url = new URL(response.header.location, 'http://not-a-real-host');
    const params = Object.fromEntries(url.searchParams.entries());

    expect(url.host).toBe('not-a-real-host');
    expect(url.pathname).toBe('/exitiframe');
    expect(params).toMatchObject(expectedParams);
  });

  it('properly redirects when running on localhost', async () => {
    shopify.api.config.hostScheme = 'http';
    shopify.api.config.hostName = 'localhost:1234';

    const response = await request(app)
      .get('/auth?shop=my-shop.myshopify.io')
      .expect(302);

    const url = new URL(response.header.location);
    const params = Object.fromEntries(url.searchParams.entries());

    expect(url.host).toBe('my-shop.myshopify.io');
    expect(params).toMatchObject(getExpectedOAuthBeginParams(shopify.api));

    const cookieNames = response.header['set-cookie'].map(
      (cookie: string) => cookie.split('=')[0],
    );
    expect(cookieNames).toEqual(['shopify_app_state', 'shopify_app_state.sig']);
  });
});
