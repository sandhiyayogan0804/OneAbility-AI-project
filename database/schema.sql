-- OneAbility AI - Core Database Schema
-- Database: oneability_db
-- Target: MySQL 8.0+ / MariaDB 10.4+

CREATE DATABASE IF NOT EXISTS `oneability_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `oneability_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) UNIQUE NULL,
    `phone_number` VARCHAR(20) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `upi_id` VARCHAR(50) UNIQUE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_email` (`email`),
    INDEX `idx_users_phone` (`phone_number`),
    INDEX `idx_users_upi` (`upi_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bank Accounts Table
CREATE TABLE IF NOT EXISTS `bank_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `ifsc_code` VARCHAR(20) NOT NULL,
    `bank_name` VARCHAR(100) NOT NULL,
    `account_type` VARCHAR(20) NOT NULL DEFAULT 'SAVINGS',
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_bank_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `uq_bank_account_ifsc` UNIQUE (`account_number`, `ifsc_code`),
    INDEX `idx_bank_accounts_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Beneficiaries Table
CREATE TABLE IF NOT EXISTS `beneficiaries` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(100) NULL,
    `upi_id` VARCHAR(50) NULL,
    `account_number` VARCHAR(50) NULL,
    `ifsc_code` VARCHAR(20) NULL,
    `phone_number` VARCHAR(20) NULL,
    `is_favorite` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_beneficiaries_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    INDEX `idx_beneficiaries_user` (`user_id`),
    INDEX `idx_beneficiaries_upi` (`upi_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `reference_id` VARCHAR(64) UNIQUE NOT NULL,
    `sender_user_id` INT NULL,
    `receiver_user_id` INT NULL,
    `sender_account_id` INT NULL,
    `receiver_account_id` INT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
    `payment_method` VARCHAR(30) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `description` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_transactions_sender_user` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_transactions_receiver_user` FOREIGN KEY (`receiver_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_transactions_sender_account` FOREIGN KEY (`sender_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_transactions_receiver_account` FOREIGN KEY (`receiver_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
    INDEX `idx_transactions_ref` (`reference_id`),
    INDEX `idx_transactions_sender` (`sender_user_id`),
    INDEX `idx_transactions_receiver` (`receiver_user_id`),
    INDEX `idx_transactions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Accessibility Preferences Table
CREATE TABLE IF NOT EXISTS `accessibility_preferences` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNIQUE NOT NULL,
    `high_contrast` BOOLEAN NOT NULL DEFAULT FALSE,
    `font_size_scale` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `screen_reader_optimized` BOOLEAN NOT NULL DEFAULT FALSE,
    `voice_guidance` BOOLEAN NOT NULL DEFAULT TRUE,
    `haptic_feedback` BOOLEAN NOT NULL DEFAULT TRUE,
    `color_blind_mode` VARCHAR(30) NOT NULL DEFAULT 'none',
    `preferred_language` VARCHAR(10) NOT NULL DEFAULT 'en',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_access_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    INDEX `idx_access_prefs_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `notification_type` VARCHAR(50) NOT NULL DEFAULT 'INFO',
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    INDEX `idx_notifications_user` (`user_id`),
    INDEX `idx_notifications_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Security Events Table
CREATE TABLE IF NOT EXISTS `security_events` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    `details` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_security_events_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    INDEX `idx_security_events_user` (`user_id`),
    INDEX `idx_security_events_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
