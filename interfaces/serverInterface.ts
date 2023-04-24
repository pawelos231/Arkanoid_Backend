import http from 'http'
export interface ServerInterface {
    handleRequesWithMiddleware: (req: any, res: any) => void

    use: (middleware: RouteMiddleware) => void

    get: (path: string, handler: RouteHandler, ...middleware: RouteMiddleware[][]) => void

    put: (path: string, handler: RouteHandler, ...middleware: RouteMiddleware[][]) => void

    patch: (path: string, handler: RouteHandler, ...middleware: RouteMiddleware[][]) => void

    delete: (path: string, handler: RouteHandler, ...middleware: RouteMiddleware[][]) => void

    post: (path: string, handler: RouteHandler, ...middleware: RouteMiddleware[][]) => void
}


export type ErrorNode = NodeJS.ErrnoException | null

export interface RouteHandler {
    (req: any, res: http.ServerResponse): any;
  }
  
export interface RouteMiddleware {
    (req: any, res: http.ServerResponse, next: Function): any;
  }

export type RequestType = 'get' | 'post' | 'put' | 'delete' | 'patch';
  
export  type Routes = {
    [path: string]: {
      [method in RequestType]?: RouteHandler;
    } & { MIDDLEWARE?: RouteMiddleware[] };
  };