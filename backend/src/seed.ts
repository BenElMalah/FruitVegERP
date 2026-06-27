import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function seed() {
  const products = [
    { name: 'Tomates (1kg)', unit: 'kg', price: 3.50 },
    { name: 'Oranges (1kg)', unit: 'kg', price: 2.80 },
    { name: 'Bananes (1kg)', unit: 'kg', price: 2.00 },
    { name: 'Pommes (1kg)', unit: 'kg', price: 3.20 },
    { name: 'Carottes (1kg)', unit: 'kg', price: 1.50 },
    { name: 'Salade Verte', unit: 'piece', price: 1.00 },
    { name: 'Oignons (1kg)', unit: 'kg', price: 1.80 },
    { name: 'Caisse Plastique', unit: 'piece', price: 5.00 },
  ];

  const { data: prods, error: prodErr } = await supabaseAdmin
    .from('products')
    .insert(products)
    .select();
  if (prodErr) { console.error('Products error:', prodErr.message); return; }
  console.log(`Inserted ${prods.length} products`);

  const clients = [
    { name: 'Ahmed Alami', phone: '0600123456', address: 'Marché Central, Casablanca', credit_limit: 15000 },
    { name: 'Fatima Benali', phone: '0612345678', address: 'Souk El Had, Marrakech', credit_limit: 10000 },
    { name: 'Hassan Idrissi', phone: '0623456789', address: 'Marché de Gros, Rabat', credit_limit: 20000 },
    { name: 'Khadija Naciri', phone: '0634567890', address: 'Marché Municipal, Fès', credit_limit: 8000 },
    { name: 'Mohammed Ouaziz', phone: '0645678901', address: 'Souk Hebdomadaire, Tanger', credit_limit: 12000 },
  ];

  const { data: clts, error: cltErr } = await supabaseAdmin
    .from('clients')
    .insert(clients)
    .select();
  if (cltErr) { console.error('Clients error:', cltErr.message); return; }
  console.log(`Inserted ${clts.length} clients`);

  const caisseTypes = [
    { name: 'Caisse Plastique Standard', category: 'branded', value: 5.00 },
    { name: 'Caisse Plastique Grande', category: 'branded', value: 8.00 },
    { name: 'Caisse Bois', category: 'foreign', value: 10.00 },
    { name: 'Caisse Client VIP', category: 'client', value: 0 },
  ];

  const { data: caisses, error: caisseErr } = await supabaseAdmin
    .from('caisse_types')
    .insert(caisseTypes)
    .select();
  if (caisseErr) { console.error('Caisse types error:', caisseErr.message); return; }
  console.log(`Inserted ${caisses.length} caisse types`);

  console.log('Seed complete!');
}

seed().catch(console.error);
