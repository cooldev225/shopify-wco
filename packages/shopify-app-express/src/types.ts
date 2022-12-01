import {Request, Response} from 'express';
import {Session, Shopify} from '@shopify/shopify-api';

import {AppConfigInterface} from './config-types';

export interface ApiAndConfigParams {
  api: Shopify;
  config: AppConfigInterface;
}

export interface RedirectToAuthParams extends ApiAndConfigParams {
  req: Request;
  res: Response;
}

export interface RedirectToHostParams {
  req: Request;
  res: Response;
  api: Shopify;
  config: AppConfigInterface;
  session: Session;
}

export interface ReturnTopLevelRedirectionParams {
  res: Response;
  config: AppConfigInterface;
  bearerPresent: boolean;
  redirectUrl: string;
}
