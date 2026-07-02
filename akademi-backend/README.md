# Akademi Backend

Akademi is an AI-powered personalized academic companion app built specifically for Nigerian public university students.

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Primary Database:** PostgreSQL
- **Cache:** Redis
- **Search:** Typesense

## Getting Started

### Prerequisites

- Node.js (v18+)
- Docker and Docker Compose
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Start the development infrastructure (PostgreSQL, Redis, Typesense):
   ```bash
   docker-compose up -d
   ```
5. Run database migrations:
   ```bash
   npm run migrate:dev
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: Start the development server with ts-node-dev
- `npm run build`: Compile the TypeScript code to JavaScript
- `npm start`: Start the production server
- `npm run migrate`: Run database migrations for production
- `npm run migrate:dev`: Run database migrations for development
- `npm test`: Run the test suite
- `npm run lint`: Run ESLint to check for code issues
- `npm run format`: Run Prettier to format the code

## Folder Structure

- `src/modules/`: Feature folders (auth, users, sessions, etc.)
- `src/jobs/`: Background tasks
- `src/shared/`: Shared types, utils, and constants
- `src/config/`: Configuration files (db, redis, env, etc.)
- `src/middleware/`: Express middleware
- `prisma/`: Database schema and migrations
- `tests/`: Test files
- `docker/`: Docker-related files

## Manual Migration Resolution
A manual database fix script (`fix-db.js`) has been added to resolve a Prisma migration conflict.
This script cleans up failed migration records in the `_prisma_migrations` table to allow `prisma migrate deploy` to proceed.

## Data Pipeline (Regulatory Sources)

Akademi uses a strict School → Faculty → Department hierarchy based on official Nigerian regulatory data.

### Importer Commands

- `npm run import:regulatory`: Runs the regulatory data synchronization in **apply** mode (writes to database).
- `npx tsx prisma/import-regulatory-data.ts --dry-run`: Performs a dry run of the importer, showing matched schools and intended department structures without modifying the database.

### Data Sources
- **Universities**: Mapped via NUC (National Universities Commission) standards.
- **Polytechnics/Monotechnics**: Mapped via NBTE (National Board for Technical Education) standards.
- **Colleges of Education**: Mapped via NCCE (National Commission for Colleges of Education) standards.

### Features
- **Name Normalization**: Automatically handles variations in institution names (e.g., "UNI" to "University", "FED" to "Federal").
- **Idempotency**: Uses Prisma `upsert` to ensure multiple runs do not create duplicate departments.
- **Hierarchy Enforcement**: Excludes individual course names from the department field, strictly adhering to regulatory programme lists.
