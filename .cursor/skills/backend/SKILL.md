# Node.js + Express + TypeScript — Cursor Rules

You are building a Node.js REST API with Express and TypeScript.
Layered architecture: controller -> service -> repository.

Project Structure:
src/
app.ts # Express setup, middleware, routes
server.ts # HTTP server, graceful shutdown
routes/ # Route definitions (thin layer)
controllers/ # Request parsing, response formatting
services/ # Business logic
repositories/ # Database queries
middleware/ # Auth, error handling, validation
types/ # TypeScript type definitions

Patterns:

- Controllers parse requests, call services, format responses
- Services contain business logic — no Express types (Request/Response)
- Repositories handle all DB queries — no SQL in services
- Middleware handles cross-cutting concerns (auth, validation, logging)

Error Handling:

- Create a central AppError class with statusCode and isOperational
- All async route handlers wrapped with asyncHandler(fn) to catch throws
- One global error middleware at the bottom of app.ts
- Distinguish operational errors (404, 401) from programmer errors (bugs)

TypeScript:

- Type all function params and return values
- Extend Express Request for auth context:
  interface AuthRequest extends Request { user: JwtPayload }
- Use Zod for runtime validation of request bodies

NEVER:

- Business logic in controllers
- Direct DB calls in services — go through repositories
- Swallowing errors without logging
