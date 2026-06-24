# ResumeX Developer & AI Agent Guidelines (GEMINI.md)

This document outlines the rigorous development standards, architectures, and practices for ResumeX. All developers and AI agents must follow these guidelines.

---

## 1. Rigorous Test-Driven Development (TDD)

To maintain code quality and prevent regressions, we enforce a strict Test-Driven Development (TDD) workflow.

### The Red-Green-Refactor Cycle
1. **Red**: Write a failing unit or integration test before writing any implementation code.
2. **Green**: Write the minimum amount of code necessary to make the test pass.
3. **Refactor**: Clean up the code (remove duplication, improve naming, optimize structure) while ensuring the tests remain green.

### 100% Test Coverage Requirement
- **Statement & Branch Coverage**: Every line of code, including error handling, conditional branches, and fallback paths, must be covered by tests.
- **Edge Cases**: Tests must cover empty inputs, invalid types, network timeouts, and database connection failures.
- **Mocking**: External APIs (OpenAI, Gemini, GitHub, LinkedIn) must be mocked using robust test doubles to ensure tests run fast and deterministically.
- **Testing Framework**: We use **Jest** for unit and integration testing. Run tests with coverage reporting enabled:
  ```bash
  npm test -- --coverage
  ```

---

## 2. Feature Branch Discipline

No development or direct commits should occur on the `main` branch.

### Git Workflow
1. **Update Main**: Pull the latest changes from the upstream repository:
   ```bash
   git checkout main
   git pull upstream main
   ```
2. **Create Feature Branch**: Create a descriptive branch for the task:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit Small, Descriptive Changes**: Group edits into logical commits with clear messages:
   ```bash
   git commit -m "feat: implement postgres vault service saveResume method"
   ```
4. **Push and Pull Request**: Push the branch to your fork (`origin`) and open a Pull Request against `upstream/main`:
   ```bash
   git push -u origin feature/your-feature-name
   ```

---

## 3. Remote Repository & Fork Configuration

To collaborate cleanly, your local repository must be configured to push to your personal fork while pulling from the upstream project.

### Forking Setup via `gh` CLI
If you have not already set up your fork:
1. **Fork the Upstream Repository**:
   ```bash
   gh repo fork --remote
   ```
   *This command creates your fork on GitHub, adds a remote named `origin` pointing to your fork, and renames the original upstream remote to `upstream`.*
2. **Configure Tracking**:
   ```bash
   git fetch origin
   git branch --set-upstream-to=origin/main main
   ```
3. **Verify Remotes**:
   ```bash
   git remote -v
   ```
   *Output should show `origin` pointing to your fork (`LiamDGray/resumex`) and `upstream` pointing to the original repository (`SaadHaider01/resumex`).*

---

## 4. Subagent Maximization & Context Conservation

When using agentic AI systems (like Antigravity), **context conservation** is critical to avoid context rot, hallucinations, and performance degradation.

### Guidelines for AI Agent Workflows
- **Decompose Tasks**: Break large features into small, independent sub-tasks.
- **Delegate to Subagents**: Maximize the use of the `invoke_subagent` tool. Use the `self` subagent for code modifications and `research` for file/web research.
- **Isolate Context**: Spawning a subagent creates a fresh conversation. When the subagent finishes, its detailed intermediate history is discarded, returning only the final result to the parent. This keeps the parent agent's context clean and focused.
- **Stateless Operation**: Do not rely on the AI agent's chat history for state. Use the filesystem (`TODO.md`, code comments, test files) as the single source of truth.

---

## 5. The Ralph Loop Paradigm

The **Ralph Loop** is an iterative development technique that prioritizes persistence, using a simple loop to run tests and linters, and repeatedly invoking the agent to fix failures until the codebase is clean.

### The Ralph Loop Concept
1. **Fresh Context**: Start each loop cycle with a clean slate to prevent context rot.
2. **External State**: Keep track of requirements and progress in `TODO.md` and test files.
3. **Deterministic Failure**: Let tests or linters fail, treat the failure output as raw data, and feed it into the next iteration to drive the fix.

### Ralph Loop Bash Script (`scripts/ralph_loop.sh`)
Use this script to automate the execution of tests in a loop during development:
```bash
#!/bin/bash
# scripts/ralph_loop.sh - Relentlessly run tests and checks

COMMAND="npm test"
MAX_ATTEMPTS=10
ATTEMPT=1

echo "🔄 Starting Ralph Loop for: $COMMAND"

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "🏃 Attempt $ATTEMPT/$MAX_ATTEMPTS..."
    eval $COMMAND
    
    if [ $? -eq 0 ]; then
        echo "✅ Success! Tests passed on attempt $ATTEMPT."
        exit 0
    else
        echo "❌ Failure on attempt $ATTEMPT."
        # If running within an agent, the agent can inspect the log and make edits here.
        # Developer can also let the agent know about the failure.
        read -p "Press Enter to retry after making edits, or Ctrl+C to exit..."
    fi
    ATTEMPT=$((ATTEMPT + 1))
done

echo "⚠️ Ralph Loop reached max attempts without passing."
exit 1
```

---

## 6. PostgreSQL Transition via Podman/Docker

We are replacing MongoDB/Mongoose with a local PostgreSQL database using the existing container image in the environment.

### Local PostgreSQL Container Setup
Start the PostgreSQL container using the existing `mirror.gcr.io/library/postgres:15.2-alpine` image:
```bash
podman run --name resumex-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=resumex \
  -p 5433:5432 \
  -d mirror.gcr.io/library/postgres:15.2-alpine
```

### Environment Configuration (`backend/.env`)
Update the backend configuration to use PostgreSQL instead of MongoDB:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=resumex
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/resumex
```

### Database Schema mapping
The MongoDB Mongoose `Resume` model is mapped to a single PostgreSQL table:

```sql
CREATE TABLE IF NOT EXISTS resumes (
    id VARCHAR(255) PRIMARY KEY,
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    github_username VARCHAR(255),
    resume_json JSONB NOT NULL,
    tailoring_blueprint JSONB NOT NULL,
    job_description TEXT,
    justification_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance matching the MongoDB index strategy
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_company_job_title ON resumes (company, job_title);
```

### Node.js Driver Integration
We use the `pg` library (PostgreSQL client for Node.js) with connection pooling for performance and reliability.
1. Install the driver:
   ```bash
   npm install pg
   ```
2. Initialize the connection pool in `backend/config/database.js`:
   ```javascript
   const { Pool } = require('pg');
   
   const pool = new Pool({
       connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/resumex'
   });
   
   module.exports = {
       query: (text, params) => pool.query(text, params),
       pool
   };
   ```
