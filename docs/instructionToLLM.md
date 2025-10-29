instruction :
After you are done making code changes, after you are completely done with code changes then only update the documentation using instruction below! 

Since you made a lot of structural design patterns, reusable patterns, and architectural changes, I want you to pinpoint existing documentation which are now updated because of your recent changes. Pinpoint the changes that you need to update and make sure you coherently and structurally update existing documentation to reflect the current state in accordance with the changes that you made.

Only the current state needs to be documented. Old state doesn't have to be there. 

Do not create new documentation, update the existing one here /home/rabin/projects/pmo/docs/

Document struction:
1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture, Block diagrams & DRY Design Patterns](#architecture--design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping) - Only if it involves api, database, uiux!
4. [Entity Relationships](#dry-principles--entity-relationships) - only if .ddl has changed
5. [Central Configuration & Middleware](#central-configuration--middleware) - if entity config, auth, or any middleware has changed. 
6. [User Interaction Flow Examples](#user-interaction-flow-examples) - how it impacts end user's interaction!
7. [Critical Considerations When building](#critical-considerations-when-editing) - Short crisp technical rundown for developers who build or extend this functionality, they need crisp knowled! 

Action: You must update all the other .md file that are referred here below:
(donot update instruction file)