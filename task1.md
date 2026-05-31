#117 Index Internal Sub-Invocations for Detailed Search Filters
Repo Avatar
Soroban-Smart-Block-Explorer/Soroban-Smart-Block
Description: Expand the database indexer to make internal contract-to-contract sub-calls fully searchable via your application's search filters.

Technical Considerations: Save sub-invocation steps as separate searchable records, linking them back to their primary parent transaction hash.

Acceptance Criteria: Searching for a specific contract ID correctly returns transactions where it was called internally as a secondary action step, not just direct interactions.

#118 Build a Transaction Status Monitoring API with Server-Sent Events (SSE)
Repo Avatar
Soroban-Smart-Block-Explorer/Soroban-Smart-Block
Description: Implement a lightweight real-time status update API using Server-Sent Events to keep users informed as their pending transactions are processed.

Technical Considerations: Provide a low-overhead, unidirectional live stream link that updates the frontend immediately when a transaction changes status from pending to success or failure.

Acceptance Criteria: The transaction monitoring page updates its status instantly without requiring the user's browser to refresh or repeatedly poll the server.

#119 Create a Batch Multi-Call Constructor Interface Panel
Repo Avatar
Soroban-Smart-Block-Explorer/Soroban-Smart-Block
Description: Build a frontend developer tool panel that lets users chain multiple contract calls together into a single transaction package.

Technical Considerations: Assemble complex multi-operation transaction envelopes by arranging sequential contract calls into an ordered execution list.

Acceptance Criteria: A user can add multiple distinct contract calls to a visual builder, order them step-by-step, and generate a single signed transaction package.

#120 Build a Quick-Copy Button for Function SDK Snippets
Repo Avatar
Soroban-Smart-Block-Explorer/Soroban-Smart-Block
Description: Add a quick-copy button that generates ready-to-use code snippets for a contract's functions across multiple popular programming languages.

Technical Considerations: Create code generation templates that dynamically populate the viewed contract ID and function signature into JavaScript, Python, and Rust code examples.

Acceptance Criteria: Clicking the copy option lets developers instantly paste a fully formed, syntax-correct code snippet into their local codebase.