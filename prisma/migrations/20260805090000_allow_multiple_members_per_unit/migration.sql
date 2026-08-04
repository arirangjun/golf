-- Allow multiple members per dong/ho; distinguish by password at login
DROP INDEX IF EXISTS "User_dong_ho_key";
CREATE INDEX IF NOT EXISTS "User_dong_ho_idx" ON "User"("dong", "ho");
