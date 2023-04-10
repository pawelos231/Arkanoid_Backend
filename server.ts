import http from 'http'
import fs from 'fs'
import path from 'path'
import { parseUrl } from './helpers/urlParser'
import { AllowCors } from './middleware/cors'
import { flatten2DArray } from './helpers/flatten'
import { NOT_FOUND } from './constants/statusCodes'
import { processMiddleware } from './middleware/process'
import { MethodsHandler, ServerInterface } from './interfaces/serverInterface'
const sharp = require('sharp');


const MIDDLEWARE = "middleware"


const TYPES = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    json: 'application/json',
    xml: 'application/xml',
  };


type ErrorNode = NodeJS.ErrnoException | null


export class Server implements ServerInterface {
    private routes: any = {}

    constructor(){
        
    }

    private BindFuncsToRoutes(
    method: string, 
    path:string,  
    handler: Function, 
    middleware: Function[] | null = null): void{
        if(typeof handler !== "function"){
            throw new Error("handler must be a func")
        }
        if (middleware && middleware.length > 0) {
            this.routes[path] = { [method]: handler, MIDDLEWARE: middleware }
        } else {
            this.routes[path] = { [method]: handler }
        }

    }

    private bodyReader(req: http.IncomingMessage): Promise<string>{
        return new Promise((resolve, reject) => {
            let body: string = ""
            req.on("data", (chunk: Buffer): void => {
                body += chunk
            })
            req.on("end", (): void => {
                resolve(body)
            })
            req.on("error", (err: Error): void => {
                reject(err);
            });
        })
    }


    private async propagateStatic(req: any, res: http.ServerResponse, pathToPropagate = "public"): Promise<void>{

        const directoryName: string = pathToPropagate;  
        const root: string = path.normalize(path.resolve(directoryName));

        const extension: string = path.extname(req.url).slice(1);
        let type = "";
      
        
            
        (extension in TYPES) ? 
        type = TYPES[extension as keyof typeof TYPES] : 
        type = TYPES.html
      
        const supportedExtension = Boolean(type);

     

        if (!supportedExtension) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404: File not found');
            return;
        } 

        let fileName = req.url;

        if (!extension) {
            try {
              fs.accessSync(path.join(root, req.url + '.html'), fs.constants.F_OK);
              fileName = req.url + '.html';
            } catch (e) {
              fileName = path.join(req.url, 'index.html');
            }
          }
          

   
        if (fs.existsSync(path.join(root, req.url)) && !extension) {

            const files = fs.readdirSync(path.join(root, req.url));
            let tempTab: Promise<unknown>[] = []

               
                files.forEach((item: string) => {

                    const promise: Promise<unknown> = new Promise((resolve, reject) => {
                        const filePath: string = path.join(root, req.url, item);
                        const image = sharp(filePath, {concurrency: 4});
                        image.resize(100, 100).toBuffer((err: any, buffer: any) => {
                            resolve(buffer)
                            if(err){
                                reject(err)
                            }
                        });
                    })
                    tempTab.push(promise)
                });

                res.writeHead(200, {'Content-Type': 'image/jpeg'});
                Promise.all(tempTab).then((values: any[]) => {
                    
                    res.end(JSON.stringify(values))
                });
               
                
        } else {

            const filePath = path.join(root, req.url)
            const image = sharp(filePath);
            image.resize(200, 200).toBuffer((err: any, buffer: any) => {
                res.setHeader('Content-Type', 'image/jpeg');
                res.end(buffer);
            });
        
         }


    }

    initServer(): MethodsHandler {
        const server = http.createServer(async (req: any, res: http.ServerResponse) => {

            if(req.url.startsWith("/music")){
                this.propagateStatic(req, res)
                return
            }   
           
            

            const keyRoutes: string[] = Object.keys(this.routes)
            let match: boolean = false
           

            for (const ROUTE of keyRoutes) {

                
                const parsedRoute: string = parseUrl(ROUTE)
                const requestMethod: string = req.method.toLowerCase()
    
                const urlMatchesMethodCorrect: boolean = new RegExp(parsedRoute).test(req.url) && this.routes[ROUTE][requestMethod]
    
                if (urlMatchesMethodCorrect) {

                    const handler: Function = this.routes[ROUTE][requestMethod]
                    const middleware: Function[] = this.routes[ROUTE][MIDDLEWARE]
                    
                    if (middleware) {
                        for (const [key, func] of middleware.entries()) {
                            processMiddleware(func, req, res)
                        }
                    }
    
                    const matcher = req.url.match(new RegExp(parsedRoute))
                    req.params = matcher.groups
                    req.body = await this.bodyReader(req)
    
                    AllowCors(res)
                    handler(req, res)
    
                    match = true
                    break;
                }
            }
    
            if (!match) {
                res.statusCode = NOT_FOUND;
                const file: string = fs.readFileSync(path.resolve(__dirname, 'views', '404.html'), {
                    encoding: "utf-8"
                })
                res.end(file)
            }
    
            res.end()
        })

        const ServerInstance: this = this

   
        server.listen(3002, () => {
            console.log("listening on port 3002")
        })
    
        return {

            get(path: string, handler: Function, ...middleware: Array<Function[]>): void {
                ServerInstance.BindFuncsToRoutes("get", path, handler, flatten2DArray(middleware))
            },

            post(path: string, handler: Function, ...middleware: Array<Function[]>): void {
                ServerInstance.BindFuncsToRoutes("post", path, handler, flatten2DArray(middleware))
                
            },

            patch(path: string, handler: Function, ...middleware: Array<Function[]>): void {
                ServerInstance.BindFuncsToRoutes("patch", path, handler, flatten2DArray(middleware))
            },

            put(path: string, handler: Function, ...middleware: Array<Function[]>): void {
                ServerInstance.BindFuncsToRoutes("put", path, handler, flatten2DArray(middleware))
            },

            delete(path: string, handler: Function, ...middleware: Array<Function[]>): void {
                ServerInstance.BindFuncsToRoutes("delete", path, handler, flatten2DArray(middleware))
            },

        }
    }
}

