/* eslint-disable no-console */
import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash as argonHash, Algorithm } from '@node-rs/argon2';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Reproducible coarse rounding mirror of src/common/geo.util.ts.
function toCoarse(lat: number, lng: number, gridKm = 1) {
  const latStep = (1 / 110.574) * gridKm;
  const lngStep = gridKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  const snap = (v: number, s: number) => Number((Math.round(v / s) * s).toFixed(5));
  return { lat: snap(lat, latStep), lng: snap(lng, lngStep) };
}

async function main() {
  const password = await argonHash('Password123!', { algorithm: Algorithm.Argon2id });

  const homeowner = await prisma.user.upsert({
    where: { email: 'homeowner@example.com' },
    update: {},
    create: {
      email: 'homeowner@example.com',
      passwordHash: password,
      role: Role.HOMEOWNER,
      firstName: 'Holly',
      lastName: 'Homeowner',
      isVerified: true,
      tosAcceptedAt: new Date(),
    },
  });

  const contractor = await prisma.user.upsert({
    where: { email: 'contractor@example.com' },
    update: { phone: '(212) 555-0199' },
    create: {
      email: 'contractor@example.com',
      passwordHash: password,
      role: Role.CONTRACTOR,
      firstName: 'Carl',
      lastName: 'Contractor',
      phone: '(212) 555-0199',
      isVerified: true,
      tosAcceptedAt: new Date(),
    },
  });

  await prisma.contractorProfile.upsert({
    where: { userId: contractor.id },
    update: {
      companyName: 'Carl Plumbing & Co',
      description: 'Licensed plumber serving NYC and surrounding areas.',
      businessAddress: '245 West 29th St, New York, NY 10001',
      serviceTypes: ['plumbing', 'electrical', 'handyman'],
      serviceRadiusKm: 40,
      baseLat: 40.7128,
      baseLng: -74.006,
      googleReviewsUrl: 'https://maps.google.com/?cid=example',
      licenseNumber: 'NYC-PLB-123456',
      ratingAgg: 4.8,
      ratingCount: 37,
    },
    create: {
      userId: contractor.id,
      companyName: 'Carl Plumbing & Co',
      description: 'Licensed plumber serving NYC and surrounding areas.',
      businessAddress: '245 West 29th St, New York, NY 10001',
      serviceTypes: ['plumbing', 'electrical', 'handyman'],
      serviceRadiusKm: 40,
      baseLat: 40.7128,
      baseLng: -74.006,
      googleReviewsUrl: 'https://maps.google.com/?cid=example',
      licenseNumber: 'NYC-PLB-123456',
      ratingAgg: 4.8,
      ratingCount: 37,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: password,
      role: Role.ADMIN,
      firstName: 'Ada',
      lastName: 'Admin',
      isVerified: true,
      tosAcceptedAt: new Date(),
    },
  });

  const sampleJobs = [
    {
      title: 'Replace 50-gallon water heater',
      description: 'Old unit is leaking. Need replacement and haul-away this week.',
      workType: 'plumbing',
      lat: 40.7138,
      lng: -74.0061,
      addressText: '12 Greenwich St, New York, NY 10013',
      budgetMin: 60000,
      budgetMax: 120000,
      role: Role.HOMEOWNER,
      by: homeowner.id,
    },
    {
      title: 'Deliver 5 tons of gravel',
      description: 'Driveway base material delivery and spread.',
      workType: 'hauling',
      lat: 40.73,
      lng: -73.99,
      addressText: '88 Bowery, New York, NY 10002',
      budgetMin: 40000,
      budgetMax: 80000,
      role: Role.CONTRACTOR,
      by: contractor.id,
    },
    {
      title: 'Deck board replacement',
      description: 'Several rotted boards on backyard deck; need carpentry repair + quote.',
      workType: 'carpentry',
      lat: 40.6782,
      lng: -73.9442,
      addressText: '200 Eastern Pkwy, Brooklyn, NY 11238',
      budgetMin: null,
      budgetMax: null,
      role: Role.HOMEOWNER,
      by: homeowner.id,
    },
  ];

  // Replace demo jobs for seed accounts (idempotent refresh).
  await prisma.job.deleteMany({
    where: { createdByUserId: { in: [homeowner.id, contractor.id] } },
  });

  for (const j of sampleJobs) {
    const coarse = toCoarse(j.lat, j.lng);
    await prisma.job.create({
      data: {
        createdByUserId: j.by,
        createdByRole: j.role,
        title: j.title,
        description: j.description,
        workType: j.workType,
        desiredDatetimeStart: new Date(Date.now() + 86400000),
        photos: [],
        addressText: j.addressText,
        locationPrecision: 'PRECISE',
        preciseLat: j.lat,
        preciseLng: j.lng,
        coarseLat: coarse.lat,
        coarseLng: coarse.lng,
        budgetMin: j.budgetMin,
        budgetMax: j.budgetMax,
        currency: 'USD',
      },
    });
  }

  console.log('Seed complete: 3 users (homeowner/contractor/admin), 3 jobs.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
