import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { newId } from '../utils/id.util';

// Gắn request_id để trace log (12-non-functional-requirements: observability).
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const id = incoming && incoming.length <= 64 ? incoming : newId();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
