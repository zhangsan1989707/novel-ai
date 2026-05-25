-- Add MiMo vendor to AI vendor enum
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'MIMO';
