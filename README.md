# NestJS + MongoDB Backend - Ad Spend Dashboard

## 📋 Overview

This document provides complete backend setup instructions for the Ad Spend Dashboard using **NestJS** framework with **MongoDB** database. The frontend is already complete and requires **NO changes**.

---

## 🛠️ Technology Stack

- **Framework**: NestJS 10.x
- **Database**: MongoDB 6.x or higher
- **ODM**: Mongoose
- **Authentication**: JWT (Passport.js)
- **Password Hashing**: bcrypt
- **Validation**: class-validator & class-transformer
- **Language**: TypeScript

---

## 📦 Project Structure

```
ad-spend-backend/
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   │   ├── signup.dto.ts
│   │   │   └── login.dto.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── schemas/
│   │   │   └── user.schema.ts
│   │   └── dto/
│   │       ├── update-user-role.dto.ts
│   │       └── set-user-active.dto.ts
│   ├── stores/
│   │   ├── stores.controller.ts
│   │   ├── stores.service.ts
│   │   ├── stores.module.ts
│   │   ├── schemas/
│   │   │   └── store.schema.ts
│   │   └── dto/
│   │       ├── create-store.dto.ts
│   │       └── update-store.dto.ts
│   ├── metrics/
│   │   ├── metrics.controller.ts
│   │   ├── metrics.service.ts
│   │   ├── metrics.module.ts
│   │   └── schemas/
│   │       └── store-metric.schema.ts
│   ├── integrations/
│   │   ├── shopify/
│   │   │   └── shopify.service.ts
│   │   ├── facebook/
│   │   │   └── facebook.service.ts
│   │   └── google/
│   │       └── google.service.ts
│   ├── jobs/
│   │   ├── sync-metrics.job.ts
│   │   └── jobs.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   └── roles.decorator.ts
│   │   └── enums/
│   │       └── user-role.enum.ts
│   ├── app.module.ts
│   └── main.ts
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start

### 1. Create NestJS Project

```bash
# Install NestJS CLI globally
npm i -g @nestjs/cli

# Create new project
nest new ad-spend-backend

# Navigate to project
cd ad-spend-backend
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @nestjs/mongoose mongoose
npm install @nestjs/passport passport passport-jwt
npm install @nestjs/jwt bcrypt
npm install class-validator class-transformer
npm install @nestjs/config
npm install @nestjs/schedule

# Type definitions
npm install -D @types/passport-jwt @types/bcrypt

# Third-party API clients
npm install axios
```

### 3. Set Up Environment Variables

Create `.env` file:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/adspend_dashboard
# For MongoDB Atlas (cloud):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/adspend_dashboard

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Shopify API
SHOPIFY_API_VERSION=2024-01

# Facebook/Meta Ads API
FB_APP_ID=your-facebook-app-id
FB_APP_SECRET=your-facebook-app-secret
FB_ACCESS_TOKEN=your-long-lived-access-token

# Google Ads API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DEVELOPER_TOKEN=your-google-developer-token
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
```

### 4. Run the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

Backend will run on: `http://localhost:3001`

---

## 🗄️ MongoDB Setup

### Option 1: Local MongoDB

**Install MongoDB:**
- Download from: https://www.mongodb.com/try/download/community
- Install and start MongoDB service

**Connection String:**
```env
MONGODB_URI=mongodb://localhost:27017/adspend_dashboard
```

### Option 2: MongoDB Atlas (Cloud - Free Tier)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster (M0 Free tier)
4. Create database user
5. Whitelist IP address (0.0.0.0/0 for development)
6. Get connection string

**Connection String:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/adspend_dashboard?retryWrites=true&w=majority
```

### Option 3: Docker MongoDB

```bash
docker run -d \
  --name mongodb-adspend \
  -p 27017:27017 \
  -e MONGO_INITDB_DATABASE=adspend_dashboard \
  mongo:6
```

**Connection String:**
```env
MONGODB_URI=mongodb://localhost:27017/adspend_dashboard
```

---

## 📊 MongoDB Schemas

### User Schema

```typescript
// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

### Store Schema

```typescript
// src/stores/schemas/store.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Store extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  shopifyToken: string;

  @Prop({ required: true })
  shopifyStoreUrl: string;

  @Prop({ required: true })
  fbAdSpendId: string;

  @Prop({ required: true })
  fbAccountId: string;

  createdAt: Date;
  updatedAt: Date;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
```

### StoreMetric Schema

```typescript
// src/metrics/schemas/store-metric.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class StoreMetric extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true })
  storeId: Types.ObjectId;

  @Prop({ required: true, type: Date })
  date: Date;

  @Prop({ default: 0 })
  facebookMetaSpend: number;

  @Prop({ default: 0 })
  googleAdSpend: number;

  @Prop({ default: 0 })
  shopifySoldOrders: number;

  @Prop({ default: 0 })
  shopifyOrderValue: number;

  @Prop({ default: 0 })
  shopifySoldItems: number;

  createdAt: Date;
  updatedAt: Date;
}

export const StoreMetricSchema = SchemaFactory.createForClass(StoreMetric);

// Create compound index for unique store + date combination
StoreMetricSchema.index({ storeId: 1, date: 1 }, { unique: true });
```

---

## 🔐 API Endpoints

### Base URL
```
http://localhost:3001/api
```

### Authentication Endpoints

#### POST `/api/auth/signup`
Create new user account

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "VIEWER"
}
```

**Response (201):**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "VIEWER",
    "isActive": true,
    "createdAt": "2024-11-27T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/login`
Login user

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2024-11-27T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### GET `/api/auth/me`
Get current user

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "ADMIN",
  "isActive": true,
  "createdAt": "2024-11-27T10:00:00.000Z"
}
```

---

### User Management (Admin Only)

#### GET `/api/users`
List all users

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "email": "admin@example.com",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2024-11-27T10:00:00.000Z"
  }
]
```

#### PATCH `/api/users/:userId/role`
Update user role

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "role": "MANAGER"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "MANAGER",
  "isActive": true,
  "createdAt": "2024-11-27T10:00:00.000Z"
}
```

#### PATCH `/api/users/:userId/active`
Set user active status

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "isActive": false
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "VIEWER",
  "isActive": false,
  "createdAt": "2024-11-27T10:00:00.000Z"
}
```

---

### Store Management

#### GET `/api/stores`
List all stores

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "gopivaid",
    "shopifyToken": "shpat_***",
    "shopifyStoreUrl": "https://gopivaid.myshopify.com",
    "fbAdSpendId": "act_123456789",
    "fbAccountId": "fb_acc_987654321",
    "createdAt": "2024-01-10T00:00:00.000Z",
    "updatedAt": "2024-01-10T00:00:00.000Z"
  }
]
```

#### GET `/api/stores/:storeId`
Get single store

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "gopivaid",
  "shopifyToken": "shpat_***",
  "shopifyStoreUrl": "https://gopivaid.myshopify.com",
  "fbAdSpendId": "act_123456789",
  "fbAccountId": "fb_acc_987654321",
  "createdAt": "2024-01-10T00:00:00.000Z",
  "updatedAt": "2024-01-10T00:00:00.000Z"
}
```

#### POST `/api/stores`
Create new store (Admin/Manager only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "newstore",
  "shopifyToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxx",
  "shopifyStoreUrl": "https://newstore.myshopify.com",
  "fbAdSpendId": "act_123456789",
  "fbAccountId": "fb_acc_987654321"
}
```

**Response (201):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "newstore",
  "shopifyToken": "shpat_***",
  "shopifyStoreUrl": "https://newstore.myshopify.com",
  "fbAdSpendId": "act_123456789",
  "fbAccountId": "fb_acc_987654321",
  "createdAt": "2024-11-27T10:00:00.000Z",
  "updatedAt": "2024-11-27T10:00:00.000Z"
}
```

#### PATCH `/api/stores/:storeId`
Update store (Admin/Manager only)

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "updatedname",
  "shopifyToken": "shpat_newtoken"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "updatedname",
  "shopifyToken": "shpat_***",
  "shopifyStoreUrl": "https://gopivaid.myshopify.com",
  "fbAdSpendId": "act_123456789",
  "fbAccountId": "fb_acc_987654321",
  "createdAt": "2024-01-10T00:00:00.000Z",
  "updatedAt": "2024-11-27T10:00:00.000Z"
}
```

#### DELETE `/api/stores/:storeId`
Delete store (Admin only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (204):** No Content

---

### Metrics Endpoints

#### GET `/api/stores/:storeId/metrics`
Get metrics for a store

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `range`: `last7days` | `last30days` | `all` (optional)
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "storeId": "507f1f77bcf86cd799439010",
    "date": "2024-11-01T00:00:00.000Z",
    "facebookMetaSpend": 450.50,
    "googleAdSpend": 320.75,
    "shopifySoldOrders": 45,
    "shopifyOrderValue": 2500.00,
    "shopifySoldItems": 78,
    "createdAt": "2024-11-01T00:00:00.000Z",
    "updatedAt": "2024-11-01T00:00:00.000Z"
  }
]
```

#### GET `/api/metrics/aggregate`
Get aggregated metrics

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `range`: `last7days` | `last30days` | `all` (default: `last30days`)

**Response (200):**
```json
{
  "totalStores": 5,
  "totalAdSpend": 15000.50,
  "totalOrders": 450,
  "totalRevenue": 75000.00,
  "dateRange": "last30days"
}
```

#### POST `/api/metrics/sync/:storeId`
Manually trigger sync (Admin/Manager only)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (202):**
```json
{
  "message": "Sync initiated for store: gopivaid",
  "jobId": "job-123456"
}
```

---

## 🔒 Authentication Implementation

### JWT Strategy

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

### JWT Auth Guard

```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### Roles Guard

```typescript
// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}
```

### Roles Decorator

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
```

---

## 🔄 Background Jobs (Data Sync)

### Using @nestjs/schedule

```typescript
// src/jobs/sync-metrics.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoresService } from '../stores/stores.service';
import { MetricsService } from '../metrics/metrics.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { FacebookService } from '../integrations/facebook/facebook.service';
import { GoogleService } from '../integrations/google/google.service';

@Injectable()
export class SyncMetricsJob {
  private readonly logger = new Logger(SyncMetricsJob.name);

  constructor(
    private storesService: StoresService,
    private metricsService: MetricsService,
    private shopifyService: ShopifyService,
    private facebookService: FacebookService,
    private googleService: GoogleService,
  ) {}

  // Run every day at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailySync() {
    this.logger.log('Starting daily metrics sync...');

    const stores = await this.storesService.findAll();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    for (const store of stores) {
      try {
        // Fetch data from all sources
        const shopifyData = await this.shopifyService.fetchOrders(
          store,
          yesterday,
          yesterday,
        );
        const fbSpend = await this.facebookService.fetchAdSpend(
          store,
          yesterday,
          yesterday,
        );
        const googleSpend = await this.googleService.fetchAdSpend(
          store,
          yesterday,
          yesterday,
        );

        // Save to database
        await this.metricsService.createOrUpdate({
          storeId: store._id,
          date: yesterday,
          facebookMetaSpend: fbSpend,
          googleAdSpend: googleSpend,
          shopifySoldOrders: shopifyData.soldOrders,
          shopifyOrderValue: shopifyData.orderValue,
          shopifySoldItems: shopifyData.soldItems,
        });

        this.logger.log(`✓ Synced metrics for ${store.name}`);
      } catch (error) {
        this.logger.error(`✗ Failed to sync ${store.name}:`, error.message);
      }
    }

    this.logger.log('Daily metrics sync completed');
  }
}
```

---

## 🌐 CORS Configuration

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
}
bootstrap();
```

---

## 📝 DTOs (Data Transfer Objects)

### Signup DTO

```typescript
// src/auth/dto/signup.dto.ts
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
```

### Login DTO

```typescript
// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

### Create Store DTO

```typescript
// src/stores/dto/create-store.dto.ts
import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  shopifyToken: string;

  @IsUrl()
  @IsNotEmpty()
  shopifyStoreUrl: string;

  @IsString()
  @IsNotEmpty()
  fbAdSpendId: string;

  @IsString()
  @IsNotEmpty()
  fbAccountId: string;
}
```

---

## 🧪 Seed Data Script

```typescript
// src/seed.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { StoresService } from './stores/stores.service';
import { MetricsService } from './metrics/metrics.service';
import * as bcrypt from 'bcrypt';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const storesService = app.get(StoresService);
  const metricsService = app.get(MetricsService);

  console.log('🌱 Seeding database...');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await usersService.create({
    email: 'admin@example.com',
    password: adminPassword,
    role: 'ADMIN',
  });
  console.log('✅ Created admin user');

  const managerPassword = await bcrypt.hash('manager123', 12);
  await usersService.create({
    email: 'manager@example.com',
    password: managerPassword,
    role: 'MANAGER',
  });
  console.log('✅ Created manager user');

  const viewerPassword = await bcrypt.hash('viewer123', 12);
  await usersService.create({
    email: 'viewer@example.com',
    password: viewerPassword,
    role: 'VIEWER',
  });
  console.log('✅ Created viewer user');

  // Create stores
  const store1 = await storesService.create({
    name: 'gopivaid',
    shopifyToken: 'shpat_demo_token_1',
    shopifyStoreUrl: 'https://gopivaid.myshopify.com',
    fbAdSpendId: 'act_123456789',
    fbAccountId: 'fb_acc_987654321',
  });
  console.log('✅ Created store: gopivaid');

  const store2 = await storesService.create({
    name: 'juhi',
    shopifyToken: 'shpat_demo_token_2',
    shopifyStoreUrl: 'https://juhi.myshopify.com',
    fbAdSpendId: 'act_111222333',
    fbAccountId: 'fb_acc_444555666',
  });
  console.log('✅ Created store: juhi');

  // Create sample metrics for last 7 days
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    await metricsService.create({
      storeId: store1._id,
      date,
      facebookMetaSpend: Math.random() * 500 + 300,
      googleAdSpend: Math.random() * 300 + 200,
      shopifySoldOrders: Math.floor(Math.random() * 50 + 20),
      shopifyOrderValue: Math.random() * 3000 + 1500,
      shopifySoldItems: Math.floor(Math.random() * 80 + 30),
    });

    await metricsService.create({
      storeId: store2._id,
      date,
      facebookMetaSpend: Math.random() * 400 + 250,
      googleAdSpend: Math.random() * 250 + 150,
      shopifySoldOrders: Math.floor(Math.random() * 40 + 15),
      shopifyOrderValue: Math.random() * 2500 + 1200,
      shopifySoldItems: Math.floor(Math.random() * 70 + 25),
    });
  }
  console.log('✅ Created sample metrics for last 7 days');

  console.log('🎉 Seeding completed!');
  await app.close();
}

seed();
```

Run seed:
```bash
ts-node src/seed.ts
```

---

## 🚀 Deployment

### Option 1: Railway

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login and deploy:
```bash
railway login
railway init
railway up
```

3. Add MongoDB:
```bash
railway add mongodb
```

### Option 2: Render

1. Create account at https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Add MongoDB database
5. Set environment variables
6. Deploy

### Option 3: Heroku

```bash
heroku create ad-spend-backend
heroku addons:create mongolab
git push heroku main
```

---

## ✅ Implementation Checklist

- [ ] Create NestJS project
- [ ] Install dependencies
- [ ] Set up MongoDB connection
- [ ] Create User schema and module
- [ ] Create Store schema and module
- [ ] Create StoreMetric schema and module
- [ ] Implement JWT authentication
- [ ] Implement role-based guards
- [ ] Create auth endpoints (signup, login, me)
- [ ] Create user management endpoints
- [ ] Create store CRUD endpoints
- [ ] Create metrics endpoints
- [ ] Set up Shopify integration
- [ ] Set up Facebook Ads integration
- [ ] Set up Google Ads integration
- [ ] Create background sync job
- [ ] Add validation (DTOs)
- [ ] Configure CORS
- [ ] Create seed script
- [ ] Test all endpoints
- [ ] Deploy to production

---

## 📚 Resources

- **NestJS Documentation**: https://docs.nestjs.com
- **Mongoose Documentation**: https://mongoosejs.com/docs
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas
- **Passport JWT**: http://www.passportjs.org/packages/passport-jwt
- **Shopify API**: https://shopify.dev/docs/api
- **Facebook Ads API**: https://developers.facebook.com/docs/marketing-api
- **Google Ads API**: https://developers.google.com/google-ads/api

---

## 🆘 Common Issues

### Issue: Cannot connect to MongoDB
**Solution:** Check MONGODB_URI and ensure MongoDB is running

### Issue: JWT token not working
**Solution:** Verify JWT_SECRET is set in .env

### Issue: CORS errors
**Solution:** Check FRONTEND_URL in .env matches your frontend URL

---

**Last Updated**: November 27, 2024  
**Framework**: NestJS 10.x  
**Database**: MongoDB 6.x  
**Frontend**: No changes required ✅
