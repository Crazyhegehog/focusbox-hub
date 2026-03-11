
-- Add contract_url column to partners
ALTER TABLE public.partners ADD COLUMN contract_url text;

-- Create storage bucket for partner contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-contracts', 'partner-contracts', false);

-- Allow authenticated users to upload contracts
CREATE POLICY "Authenticated users can upload contracts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'partner-contracts');

-- Allow authenticated users to read contracts
CREATE POLICY "Authenticated users can read contracts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'partner-contracts');

-- Allow authenticated users to delete contracts
CREATE POLICY "Authenticated users can delete contracts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'partner-contracts');
