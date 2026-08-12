/**
 * InsightCart AI — Database Seeder
 * Run: node database/seed.js
 * Seeds: admin user, customer users, and sample products
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User    = require('../backend/models/User');
const Product = require('../backend/models/Product');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/insightcart_ai';

const sampleProducts = [
  // Electronics
  { name: 'Sony WH-1000XM5 Headphones', description: 'Industry-leading noise cancelling wireless headphones with exceptional sound quality and up to 30 hours battery life.', price: 349.99, category: 'Electronics', brand: 'Sony', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', stock: 45, rating: 4.8, reviewCount: 2341, tags: ['headphones', 'wireless', 'noise-cancelling'], trendScore: 95 },
  { name: 'Apple MacBook Air M2', description: 'Supercharged by the next-generation M2 chip. Strikingly thin design, 13.6" Liquid Retina display, 18-hour battery life.', price: 1099.00, category: 'Electronics', brand: 'Apple', imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400', stock: 22, rating: 4.9, reviewCount: 5621, tags: ['laptop', 'apple', 'macbook', 'm2'], trendScore: 99 },
  { name: 'Samsung 4K OLED TV 55"', description: 'Stunning 4K OLED display with infinite contrast, HDR support, and built-in smart TV features.', price: 1299.00, category: 'Electronics', brand: 'Samsung', imageUrl: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400', stock: 15, rating: 4.7, reviewCount: 892, tags: ['tv', 'oled', '4k', 'samsung'], trendScore: 78 },
  { name: 'iPad Pro 12.9" M2', description: 'The ultimate iPad experience with M2 chip, Liquid Retina XDR display, and Apple Pencil support.', price: 1099.00, category: 'Electronics', brand: 'Apple', imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400', stock: 30, rating: 4.8, reviewCount: 3201, tags: ['ipad', 'tablet', 'apple'], trendScore: 88 },
  { name: 'Logitech MX Master 3S Mouse', description: 'Advanced wireless mouse with ultra-fast MagSpeed scrolling, quiet clicks, and ergonomic design.', price: 99.99, category: 'Electronics', brand: 'Logitech', imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400', stock: 120, rating: 4.7, reviewCount: 4102, tags: ['mouse', 'wireless', 'ergonomic'], trendScore: 82 },

  // Clothing
  { name: 'Classic Oxford Button-Down Shirt', description: 'Premium 100% cotton Oxford shirt with a timeless fit. Perfect for office or casual wear.', price: 69.99, category: 'Clothing', brand: 'FabricCo', imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400', stock: 200, rating: 4.4, reviewCount: 1230, tags: ['shirt', 'oxford', 'formal', 'cotton'], trendScore: 60 },
  { name: 'Premium Slim-Fit Jeans', description: 'Stretch denim slim-fit jeans with a modern silhouette. Available in multiple washes.', price: 89.99, category: 'Clothing', brand: 'DenimLab', imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400', stock: 180, rating: 4.5, reviewCount: 2150, tags: ['jeans', 'denim', 'slim-fit'], trendScore: 65 },
  { name: 'Merino Wool Sweater', description: 'Luxuriously soft 100% Merino wool sweater. Temperature regulating, itch-free, machine washable.', price: 129.99, category: 'Clothing', brand: 'WoolWorks', imageUrl: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=400', stock: 95, rating: 4.6, reviewCount: 780, tags: ['sweater', 'wool', 'merino', 'knitwear'], trendScore: 55 },
  { name: 'Athletic Performance Jacket', description: 'Wind and water resistant running jacket with reflective details and packable design.', price: 119.99, category: 'Clothing', brand: 'SportEdge', imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400', stock: 75, rating: 4.5, reviewCount: 560, tags: ['jacket', 'running', 'athletic', 'waterproof'], trendScore: 70 },

  // Books
  { name: 'Atomic Habits by James Clear', description: 'An easy and proven way to build good habits and break bad ones. #1 New York Times bestseller.', price: 18.99, category: 'Books', brand: 'Avery', imageUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400', stock: 500, rating: 4.9, reviewCount: 87654, tags: ['self-help', 'habits', 'productivity', 'bestseller'], trendScore: 92 },
  { name: 'The Psychology of Money', description: 'Timeless lessons on wealth, greed, and happiness. Morgan Housel explores the strange ways people think about money.', price: 16.99, category: 'Books', brand: 'Harriman House', imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400', stock: 420, rating: 4.8, reviewCount: 54320, tags: ['finance', 'psychology', 'investing', 'bestseller'], trendScore: 89 },
  { name: 'Clean Code by Robert Martin', description: 'A handbook of agile software craftsmanship. Essential reading for every professional developer.', price: 44.99, category: 'Books', brand: "O'Reilly", imageUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400', stock: 150, rating: 4.7, reviewCount: 23100, tags: ['programming', 'software', 'coding', 'technical'], trendScore: 75 },

  // Home & Kitchen
  { name: 'Instant Pot Duo 7-in-1', description: 'Multi-use programmable pressure cooker, slow cooker, rice cooker, steamer, sauté, yogurt maker, and warmer.', price: 99.95, category: 'Home & Kitchen', brand: 'Instant Pot', imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400', stock: 88, rating: 4.8, reviewCount: 145000, tags: ['pressure-cooker', 'kitchen', 'cooking', 'instant-pot'], trendScore: 87 },
  { name: 'Dyson V15 Detect Vacuum', description: 'Laser dust detection, acoustic piezo sensor, and HEPA filtration. The most powerful Dyson cordless vacuum.', price: 749.99, category: 'Home & Kitchen', brand: 'Dyson', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', stock: 35, rating: 4.7, reviewCount: 12300, tags: ['vacuum', 'dyson', 'cordless', 'cleaning'], trendScore: 80 },
  { name: 'Fellow Stagg EKG Kettle', description: 'Electric pour-over kettle with variable temperature control and built-in stopwatch. Barista-grade precision.', price: 165.00, category: 'Home & Kitchen', brand: 'Fellow', imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400', stock: 60, rating: 4.8, reviewCount: 8900, tags: ['kettle', 'coffee', 'pour-over', 'barista'], trendScore: 72 },

  // Sports & Fitness
  { name: 'Yoga Mat Premium 6mm', description: 'Non-slip premium yoga mat with alignment lines and carrying strap. Extra thick 6mm for joint comfort.', price: 59.99, category: 'Sports & Fitness', brand: 'ZenFlex', imageUrl: 'https://images.unsplash.com/photo-1601925228442-d8df5b03bdd9?w=400', stock: 250, rating: 4.6, reviewCount: 7800, tags: ['yoga', 'mat', 'fitness', 'exercise'], trendScore: 68 },
  { name: 'Adjustable Dumbbells Set 5-50lb', description: 'Space-saving adjustable dumbbells that replace 15 sets. Dial-select weight system, durable construction.', price: 349.00, category: 'Sports & Fitness', brand: 'PowerBlock', imageUrl: 'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=400', stock: 40, rating: 4.7, reviewCount: 5600, tags: ['dumbbells', 'weights', 'gym', 'strength'], trendScore: 76 },
  { name: 'Running Shoes Ultra Boost', description: 'Responsive boost cushioning with Primeknit upper. Ultimate comfort and energy return for long runs.', price: 179.99, category: 'Sports & Fitness', brand: 'StrideX', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', stock: 130, rating: 4.6, reviewCount: 9200, tags: ['running', 'shoes', 'sneakers', 'fitness'], trendScore: 84 },

  // Beauty & Personal Care
  { name: 'Vitamin C Brightening Serum', description: '20% Vitamin C serum with hyaluronic acid and vitamin E. Brightens skin, reduces dark spots, anti-aging.', price: 39.99, category: 'Beauty', brand: 'GlowLab', imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400', stock: 300, rating: 4.5, reviewCount: 18700, tags: ['skincare', 'serum', 'vitamin-c', 'brightening'], trendScore: 78 },
  { name: 'Hydrating Face Moisturizer SPF30', description: 'Lightweight daily moisturizer with SPF30 protection. Non-comedogenic, fragrance-free, dermatologist tested.', price: 24.99, category: 'Beauty', brand: 'ClearSkin', imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400', stock: 400, rating: 4.6, reviewCount: 22400, tags: ['moisturizer', 'spf', 'skincare', 'sunscreen'], trendScore: 71 },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@insightcart.ai',
      password: 'Admin@123',
      role: 'admin',
    });
    console.log(`👤 Admin created: ${adminUser.email} / Admin@123`);

    // Create sample customers
    const customers = await User.create([
      { name: 'Alice Johnson', email: 'alice@example.com', password: 'Pass@123', role: 'customer' },
      { name: 'Bob Smith',     email: 'bob@example.com',   password: 'Pass@123', role: 'customer' },
      { name: 'Carol White',   email: 'carol@example.com', password: 'Pass@123', role: 'customer' },
    ]);
    console.log(`👥 ${customers.length} customers created (password: Pass@123)`);

    // Create products
    const products = await Product.insertMany(sampleProducts);
    console.log(`📦 ${products.length} products seeded`);

    console.log('\n✨ Seeding complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin login:    admin@insightcart.ai / Admin@123');
    console.log('Customer login: alice@example.com / Pass@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
