-- CreateTable
CREATE TABLE "PoItemImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/png',
    "data" BLOB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoItemImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PurchaseOrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
