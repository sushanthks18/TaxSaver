import { db } from '../database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  panNumber?: string;
  taxRegime?: 'old' | 'new';
  isEmailVerified: boolean;
  createdAt: Date;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<{ user: User; token: string }> {
    const { email, password, firstName, lastName } = input;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new ApiError(400, 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, first_name, last_name, is_email_verified, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName]
    );

    const user: User = {
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      firstName: result.rows[0].first_name,
      lastName: result.rows[0].last_name,
      isEmailVerified: result.rows[0].is_email_verified,
      createdAt: result.rows[0].created_at,
    };

    // Generate JWT token
    const token = this.generateToken(user.userId, user.email);

    logger.info('User registered successfully', { userId: user.userId, email: user.email });

    return { user, token };
  }

  async login(input: LoginInput): Promise<{ user: User; token: string }> {
    const { email, password } = input;

    // Find user
    const result = await db.query(
      `SELECT user_id, email, password_hash, first_name, last_name, 
              pan_number, tax_regime, is_email_verified, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const userData = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userData.password_hash);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userData.user_id]
    );

    const user: User = {
      userId: userData.user_id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      panNumber: userData.pan_number,
      taxRegime: userData.tax_regime,
      isEmailVerified: userData.is_email_verified,
      createdAt: userData.created_at,
    };

    // Generate JWT token
    const token = this.generateToken(user.userId, user.email);

    logger.info('User logged in successfully', { userId: user.userId, email: user.email });

    return { user, token };
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await db.query(
      `SELECT user_id, email, first_name, last_name, pan_number, 
              tax_regime, is_email_verified, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const userData = result.rows[0];
    return {
      userId: userData.user_id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      panNumber: userData.pan_number,
      taxRegime: userData.tax_regime,
      isEmailVerified: userData.is_email_verified,
      createdAt: userData.created_at,
    };
  }

  private generateToken(userId: string, email: string): string {
    const secret = config.jwt.secret;
    if (!secret) throw new Error('JWT secret not configured');
    
    return jwt.sign(
      { userId, email },
      secret,
      { expiresIn: '7d' }
    );
  }
}

export const authService = new AuthService();
