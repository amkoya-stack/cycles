/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { DatabaseService } from '../database/database.service';
import { mapQueryRow } from '../database/mapper.util';
import { TokenizationService } from '../common/services/tokenization.service';
import { CreateUserDto } from './dto/create-user.dto';
import { BasicKycDto } from '../auth/dto/basic-kyc.dto';
import { NextOfKinDto } from '../auth/dto/next-of-kin.dto';
import { ProfileDto } from '../auth/dto/profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ledgerService: LedgerService,
    private readonly tokenization: TokenizationService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserRow> {
    const userResult = await this.db.query<UserRow>(
      `INSERT INTO users (first_name, last_name)
       VALUES ($1, $2)
       RETURNING *`,
      [createUserDto.firstName, createUserDto.lastName],
    );

    const user = mapQueryRow<any>(userResult);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.ledgerService.createUserWallet(
      user.id,
      `${user.first_name} ${user.last_name}`,
    );

    return user;
  }

  async updateBasicKyc(userId: string, dto: BasicKycDto) {
    // Tokenize id_number before storing
    const tokenizedIdNumber = dto.idNumber 
      ? await this.tokenization.tokenize(dto.idNumber, 'id_number')
      : null;
    
    await this.db.query(
      'UPDATE users SET id_number = $1, full_name = $2, dob = $3 WHERE id = $4',
      [tokenizedIdNumber, dto.fullName, dto.dob, userId],
    );
    return { status: 'kyc_saved' };
  }

  async addNextOfKin(userId: string, dto: NextOfKinDto) {
    // Tokenize phone number before storing
    const tokenizedPhone = dto.phone 
      ? await this.tokenization.tokenize(dto.phone, 'phone')
      : null;
    
    await this.db.query(
      'INSERT INTO next_of_kin (user_id, name, phone, relationship) VALUES ($1, $2, $3, $4)',
      [userId, dto.name, tokenizedPhone, dto.relationship],
    );
    return { status: 'nok_saved' };
  }

  async updateProfile(userId: string, dto: ProfileDto) {
    // Tokenize id_number if provided
    const tokenizedIdNumber = dto.id_number 
      ? await this.tokenization.tokenize(dto.id_number, 'id_number')
      : null;
    
    await this.db.query(
      `UPDATE users SET 
        profile_photo_url = COALESCE($1, profile_photo_url), 
        bio = COALESCE($2, bio),
        full_name = COALESCE($3, full_name),
        dob = COALESCE($4, dob),
        id_number = COALESCE($5, id_number),
        website = COALESCE($6, website),
        facebook = COALESCE($7, facebook),
        twitter = COALESCE($8, twitter),
        linkedin = COALESCE($9, linkedin)
      WHERE id = $10`,
      [
        dto.profilePhotoUrl ?? null,
        dto.bio ?? null,
        dto.full_name ?? null,
        dto.date_of_birth ?? null,
        tokenizedIdNumber,
        dto.website ?? null,
        dto.facebook ?? null,
        dto.twitter ?? null,
        dto.linkedin ?? null,
        userId,
      ],
    );
    return { status: 'profile_saved' };
  }

  async getUserProfile(userId: string) {
    console.log('getUserProfile called for userId:', userId);

    try {
      const result = await this.db.query(
        `SELECT 
          id, 
          full_name, 
          email, 
          phone,
          profile_photo_url,
          bio,
          dob,
          id_number,
          website,
          facebook,
          twitter,
          linkedin,
          created_at
        FROM users 
        WHERE id = $1`,
        [userId],
      );

      console.log('Query result rows:', result.rows.length);

      if (result.rows.length === 0) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const user = result.rows[0];
      
      // Detokenize sensitive fields
      if (user.email) {
        user.email = await this.tokenization.detokenize(user.email, 'email');
      }
      if (user.phone) {
        user.phone = await this.tokenization.detokenize(user.phone, 'phone');
      }
      if (user.id_number) {
        user.id_number = await this.tokenization.detokenize(user.id_number, 'id_number');
      }

      return user;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  }
}

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
};
