import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from '../modules/users/schemas/user.schema';
import {
  Organization,
  OrganizationDocument,
  OrganizationStatus,
} from '../modules/organizations/schemas/organization.schema';
import {
  LeadQuestion,
  LeadQuestionDocument,
} from '../modules/knowledge/schemas/lead-question.schema';
import {
  CompanyInformation,
  CompanyInformationDocument,
} from '../modules/knowledge/schemas/company-information.schema';
import {
  AdditionalInformation,
  AdditionalInformationDocument,
} from '../modules/knowledge/schemas/additional-information.schema';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(LeadQuestion.name)
    private readonly questionModel: Model<LeadQuestionDocument>,
    @InjectModel(CompanyInformation.name)
    private readonly companyInfoModel: Model<CompanyInformationDocument>,
    @InjectModel(AdditionalInformation.name)
    private readonly additionalInfoModel: Model<AdditionalInformationDocument>,
  ) {}

  async onApplicationBootstrap() {
    if (
      process.env.SEED_DEMO_DATA === 'true' &&
      process.env.NODE_ENV !== 'production'
    ) {
      await this.seed(false);
    }
  }

  async seed(force = false) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Demo seeding is disabled in production');
    }
    const existingUsers = await this.userModel.countDocuments();
    if (existingUsers > 0 && !force) {
      this.logger.log(
        'Database already contains users. Skipping default seeder.',
      );
      return;
    }

    this.logger.log(
      'Seeding initial Organization, Admin User, and Knowledge data...',
    );

    // 1. Create or Find Default Organization
    let organization = await this.orgModel.findOne({ name: 'Air Ticket Tour' });
    if (!organization) {
      organization = await this.orgModel.create({
        name: 'Air Ticket Tour',
        status: OrganizationStatus.ACTIVE,
        instagramAccessToken: 'EAABsbCS1iHgBO_sample_token',
        instagramBusinessAccountId: '17841480623895283',
        instagramVerifyToken:
          '17bc20a31da65e4138562e4b48e4eb48c10c7cb3547998b37efd03cbf8e4624c',
        instagramApiBaseUrl: 'https://graph.instagram.com',
        metaGraphApiVersion: 'v23.0',
      });
    }

    const orgId = organization._id;

    // 2. Create or Update Default Admin User
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const existingAdmin = await this.userModel.findOne({
      email: 'admin@airticket.uz',
    });
    if (!existingAdmin) {
      await this.userModel.create({
        organizationId: orgId,
        fullName: 'Ali Valiyev',
        email: 'admin@airticket.uz',
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });
    }

    // 3. Populate Company Information
    const existingCompanyInfo = await this.companyInfoModel.countDocuments({
      organizationId: orgId,
    });
    if (existingCompanyInfo === 0 || force) {
      if (force)
        await this.companyInfoModel.deleteMany({ organizationId: orgId });
      await this.companyInfoModel.insertMany([
        {
          organizationId: orgId,
          title: 'Kompaniya haqida',
          description:
            "Air Ticket Tour — dunyoning barcha yo'nalishlariga sifatli sayohat turlari, viza ko'magi va aviachiptalar xizmatini taqdim etuvchi yetakchi turoperator.",
        },
        {
          organizationId: orgId,
          title: 'Ish vaqti',
          description:
            'Dushanbadan shanbagacha 09:00 dan 19:00 gacha ishlaymiz. Yakshanba — dam olish kuni.',
        },
        {
          organizationId: orgId,
          title: 'Manzil va aloqa',
          description:
            'Toshkent sh., Amir Temur ko‘chasi 45-uy. Telefon: +998 71 200 00 00, Telegram: @airtickettour_support',
        },
        {
          organizationId: orgId,
          title: "To'lov usullari",
          description:
            "Naqd pul, bank kartalari (Uzcard, Humo, Visa, Mastercard) va korporativ bank o'tkazmasi orqali qabul qilinadi.",
        },
      ]);
    }

    // 4. Populate Additional Information (FAQs & Policies)
    const existingAddInfo = await this.additionalInfoModel.countDocuments({
      organizationId: orgId,
    });
    if (existingAddInfo === 0 || force) {
      if (force)
        await this.additionalInfoModel.deleteMany({ organizationId: orgId });
      await this.additionalInfoModel.insertMany([
        {
          organizationId: orgId,
          title: 'Pasport muddati',
          description:
            "Xorijga sayohat qilish uchun xorijga chiqish biometrik (qizil) pasportining amal qilish muddati safar tugagan kundan boshlab kamida 6 oy bo'lishi shart.",
        },
        {
          organizationId: orgId,
          title: 'Viza chiqish muddati',
          description:
            'Turkiya, BAA (Dubay) va Misr vizalari 2-4 ish kunida, Yevropa Shengen vizalari 15-20 ish kunida rasmiylashtiriladi.',
        },
        {
          organizationId: orgId,
          title: 'Aviachiptani qaytarish va almashtirish',
          description:
            'Charter reyslar chiptalari qaytarilmaydi. Muntazam reyslar aviatsiya qoidalariga ko‘ra jarima asosida qaytariladi yoki almashtiriladi.',
        },
        {
          organizationId: orgId,
          title: 'Bolalar uchun chegirmalar',
          description:
            "2 yoshgacha bo'lgan chaqaloqlar uchun chiptalarga 90% gacha, 2 yoshdan 12 yoshgacha bo'lgan bolalarga 25% dan 50% gacha chegirmalar mavjud.",
        },
      ]);
    }

    // 5. Populate Lead Questions
    const existingQuestions = await this.questionModel.countDocuments({
      organizationId: orgId,
    });
    if (existingQuestions === 0 || force) {
      if (force) await this.questionModel.deleteMany({ organizationId: orgId });
      await this.questionModel.insertMany([
        {
          organizationId: orgId,
          title: 'Telefon raqami',
          description: "Mijozdan bog'lanish uchun telefon raqamini so'rang.",
          order: 1,
        },
        {
          organizationId: orgId,
          title: "Mijozning to'liq ismi",
          description:
            'Mijozdan unga qanday murojaat qilish mumkinligini (ism-familiyasini) so‘rang.',
          order: 2,
        },
        {
          organizationId: orgId,
          title: 'Sayohat manzili',
          description:
            'Mijoz qaysi davlat yoki shaharga sayohat qilmoqchi ekanligini aniqlang (masalan: Turkiya Antaliya, Dubay, Misr Sharm-el-Sheyx).',
          order: 3,
        },
        {
          organizationId: orgId,
          title: 'Sayohat sanasi',
          description:
            'Mijoz taxminan qachon sayohat qilishni rejalashtirayotganini (oy yoki aniq sanalarni) so‘rang.',
          order: 4,
        },
        {
          organizationId: orgId,
          title: 'Budjet',
          description:
            'Mijozning bitta kishi yoki oila uchun mo‘ljallangan taxminiy budjetini (USD yoki UZS da) aniqlang.',
          order: 5,
        },
      ]);
    }

    this.logger.log('✅ Seed completed successfully!');
    this.logger.log(`Default Organization ID: ${orgId.toString()}`);
    this.logger.log(`Default Admin Email:    admin@airticket.uz`);
    this.logger.log(`Default Admin Password: Password123!`);
  }
}
