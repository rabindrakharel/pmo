documentation:
Imagine you are a staff, advanced software engineer and solutions architect; Crisp and coherent documentation of design patterns, reusable patterns, and architecture. Plus if any recent change, Only document the final state - I want you to pinpoint existing documentation which are now updated because of your recent changes. Pinpoint the changes that you need to update and make sure you coherently and structurally update existing documentation to reflect the current state.

You are writing this to another LLM agent who is  highly technical staff architect and engineer

Access how current state of things work, understand the current state of truth, and document coherent system architecture and flow.  the current state needs to be documented. Old state doesn't have to be there.

Document struction:
1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture, Block diagrams & DRY Design Patterns](#architecture--design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping) - Only if it involves api, database, uiux!
4. [Entity Relationships](#dry-principles--entity-relationships) - only if .ddl has changed
5. [Central Configuration & Middleware](#central-configuration--middleware) - if entity config, auth, or any middleware has changed. 
6. [User Interaction Flow Examples](#user-interaction-flow-examples) - how it impacts end user's interaction!
7. [Critical Considerations When building](#critical-considerations-when-editing) - Short crisp technical rundown for developers who build or extend this functionality, they need crisp knowledge! 

Action: You must update all the other .md file that are referred here below:
(donot update instruction file)


critic: 
be super smart, and next generation expert and compare this approach with other advanced implementations, and rate my code, design pattern; critic and suggest:
1. Overall Rating & Executive Summary
  2. Architecture Analysis
    - Convention over Configuration
    - DRY principles
    - Type safety
    - Performance optimization
  3. Comparison with Industry Standards
    - React Query / TanStack Table
    - Headless UI patterns
    - Modern state management
    - Enterprise data grids (ag-Grid, MUI DataGrid)
  4. Strengths (what's done well)
  5. Weaknesses & Gaps (what's missing)
  6. Critical Issues (what needs immediate attention)
  7. Advanced Patterns Not Implemented
  8. Recommendations (concrete improvements)

  put the conent in featureadd/critic.md\
  \
  understand current state: \
  /home/rabin/projects/pmo/docs/core_algorithm_design_pattern.md
  /home/rabin/projects/pmo/docs/datatable.md 



  Now go on to reate api, and ui details for quote, product and service. Goal is to have same components reused, dry princple adhered, no much extra coding, but using existing
  template, You can refer to project/task and how it's done. \
  Design patterns strictly followed. \\
  don't read all of the docs below but grep search the content below and link the knowledge.
  /home/rabin/projects/pmo/docs/datatable/datatable.md\
  /home/rabin/projects/pmo/docs/s3_service\
  /home/rabin/projects/pmo/docs/styling_patterns.md\
  /home/rabin/projects/pmo/docs/datamodel/datamodel.md\
  /home/rabin/projects/pmo/docs/settings/settings.md 
────────────────────────────────────────────────────────