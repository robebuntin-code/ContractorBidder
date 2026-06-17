import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreateSessionDto } from './dto/create-session.dto';

// Express augmented with rawBody (enabled via NestFactory { rawBody: true }).
type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('session')
  @UseGuards(JwtAuthGuard)
  createSession(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.payments.createSession(user.userId, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.payments.getById(user.userId, id);
    if (!payment)
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
    return payment;
  }

  // Public endpoint; authenticated by Stripe signature, not JWT.
  @SkipThrottle()
  @Post('webhook/stripe')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest, @Headers('stripe-signature') signature?: string) {
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
