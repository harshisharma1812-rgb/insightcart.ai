-- ============================================================
-- InsightCart AI — MySQL Schema (Alternative to MongoDB)
-- ============================================================

CREATE DATABASE IF NOT EXISTS insightcart_ai;
USE insightcart_ai;

-- Users
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('customer', 'admin') DEFAULT 'customer',
  avatar      VARCHAR(500),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE products (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  price           DECIMAL(10,2) NOT NULL,
  category        VARCHAR(100) NOT NULL,
  brand           VARCHAR(100),
  image_url       VARCHAR(500),
  stock           INT DEFAULT 0,
  rating          DECIMAL(3,2) DEFAULT 0,
  review_count    INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  view_count      INT DEFAULT 0,
  cart_add_count  INT DEFAULT 0,
  purchase_count  INT DEFAULT 0,
  trend_score     FLOAT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_trend_score (trend_score DESC),
  FULLTEXT idx_search (name, description)
);

-- Product Tags
CREATE TABLE product_tags (
  product_id  INT NOT NULL,
  tag         VARCHAR(100) NOT NULL,
  PRIMARY KEY (product_id, tag),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Cart Items
CREATE TABLE cart_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_cart (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Orders
CREATE TABLE orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  tax              DECIMAL(10,2) DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  status           ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  payment_status   ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  payment_method   VARCHAR(50) DEFAULT 'card',
  payment_ref      VARCHAR(100),
  shipping_street  VARCHAR(255),
  shipping_city    VARCHAR(100),
  shipping_state   VARCHAR(100),
  shipping_zip     VARCHAR(20),
  shipping_country VARCHAR(100),
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Order Items (snapshot at time of order)
CREATE TABLE order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  product_id  INT,
  name        VARCHAR(255) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  quantity    INT NOT NULL,
  image_url   VARCHAR(500),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Behavior Events
CREATE TABLE behavior_events (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  session_id  VARCHAR(100) NOT NULL,
  event_type  ENUM('view','click','search','add_to_cart','remove_from_cart','purchase','dwell','page_visit') NOT NULL,
  product_id  INT,
  category    VARCHAR(100),
  query       VARCHAR(500),
  dwell_ms    INT,
  metadata    JSON,
  ip          VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id    (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_event_type (event_type),
  INDEX idx_product_id (product_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB ROW_FORMAT=COMPRESSED;

-- User Behavior Profiles (aggregated)
CREATE TABLE user_profiles (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  user_id               INT NOT NULL UNIQUE,
  recent_searches       JSON,
  recommended_product_ids JSON,
  total_page_views      INT DEFAULT 0,
  total_searches        INT DEFAULT 0,
  total_purchases       INT DEFAULT 0,
  avg_session_ms        INT DEFAULT 0,
  last_activity_at      TIMESTAMP,
  profile_updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Category Affinities (per user)
CREATE TABLE category_affinities (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  category        VARCHAR(100) NOT NULL,
  score           FLOAT DEFAULT 0,
  view_count      INT DEFAULT 0,
  purchase_count  INT DEFAULT 0,
  UNIQUE KEY unique_affinity (user_id, category),
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

-- Product Interactions (per user)
CREATE TABLE product_interactions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  product_id      INT NOT NULL,
  view_count      INT DEFAULT 0,
  dwell_ms        INT DEFAULT 0,
  added_to_cart   BOOLEAN DEFAULT FALSE,
  purchased       BOOLEAN DEFAULT FALSE,
  last_seen_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_interaction (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- Useful Analytics Views
-- ============================================================

-- Conversion funnel per product
CREATE VIEW product_funnel AS
SELECT
  p.id,
  p.name,
  p.category,
  p.view_count,
  p.cart_add_count,
  p.purchase_count,
  ROUND(p.cart_add_count / NULLIF(p.view_count, 0) * 100, 2)     AS view_to_cart_pct,
  ROUND(p.purchase_count / NULLIF(p.cart_add_count, 0) * 100, 2) AS cart_to_purchase_pct
FROM products p
WHERE p.is_active = TRUE;

-- Top categories by revenue
CREATE VIEW category_revenue AS
SELECT
  p.category,
  COUNT(DISTINCT o.id)   AS total_orders,
  SUM(oi.quantity)       AS units_sold,
  SUM(oi.price * oi.quantity) AS revenue
FROM order_items oi
JOIN products p  ON oi.product_id = p.id
JOIN orders o    ON oi.order_id   = o.id
WHERE o.payment_status = 'paid'
GROUP BY p.category
ORDER BY revenue DESC;
