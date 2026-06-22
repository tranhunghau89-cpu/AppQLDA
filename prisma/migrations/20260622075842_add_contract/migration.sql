-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "contractNo" TEXT,
    "signDate" DATETIME,
    "subject" TEXT,
    "partyAName" TEXT,
    "partyAInfo" TEXT,
    "valueBeforeVat" REAL,
    "vatPercent" REAL DEFAULT 8,
    "valueWithVat" REAL,
    "paymentTerms" TEXT,
    "filePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUOTE',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "qty" REAL,
    "unitPrice" REAL,
    "amount" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
