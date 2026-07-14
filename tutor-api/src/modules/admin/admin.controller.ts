import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AdminService } from "./admin.service";
import {
  AdminAuditLogsQueryDto,
  AdminOverviewQueryDto,
  AdminPaymentsQueryDto,
  AdminSystemLogsQueryDto,
  AdminUsersQueryDto,
  AdminUserStatusDto,
  ModerateMediaDto,
  ModerateReviewDto,
  PaidFeatureOverrideDto,
  PlatformPaymentAccountDto,
  PricingDto,
  RefundDto,
  TutorStatusDto,
} from "./dto/admin.dto";
import { Roles } from "../../common/auth/roles.decorator";
import { CurrentUser, AuthUser } from "../../common/auth/auth-user";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Roles("admin")
  @Get("overview")
  overview(@Query() query: AdminOverviewQueryDto) {
    return this.admin.overview(query);
  }

  @Roles("admin")
  @Get("users")
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Roles("admin")
  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.admin.getUser(id);
  }

  @Roles("admin")
  @Patch("users/:id/status")
  setUserStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AdminUserStatusDto,
  ) {
    return this.admin.setUserStatus(user.userId, id, dto);
  }

  @Roles("admin")
  @Get("system-logs")
  systemLogs(@Query() query: AdminSystemLogsQueryDto) {
    return this.admin.systemLogs(query);
  }

  @Roles("admin")
  @Get("platform/payment-account")
  getPlatformPaymentAccount() {
    return this.admin.getPlatformPaymentAccount();
  }

  @Roles("admin")
  @Patch("platform/payment-account")
  setPlatformPaymentAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: PlatformPaymentAccountDto,
  ) {
    return this.admin.setPlatformPaymentAccount(user.userId, dto);
  }

  @Roles("admin")
  @Get("pricing")
  listPricing() {
    return this.admin.listPricing();
  }

  @Roles("admin")
  @Patch("pricing/:productType")
  setPricing(
    @CurrentUser() user: AuthUser,
    @Param("productType") productType: string,
    @Body() dto: PricingDto,
  ) {
    return this.admin.setPricing(user.userId, productType, dto);
  }

  @Roles("admin")
  @Get("users/:id/paid-features")
  getPaidFeatures(@Param("id") id: string) {
    return this.admin.getPaidFeatures(id);
  }

  @Roles("admin")
  @Patch("users/:id/paid-features/:feature")
  setPaidFeature(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("feature") feature: string,
    @Body() dto: PaidFeatureOverrideDto,
  ) {
    return this.admin.setPaidFeature(user.userId, id, feature, dto);
  }

  @Roles("admin")
  @Get("moderation/queue")
  moderationQueue() {
    return this.admin.moderationQueue();
  }

  @Roles("admin")
  @Get("payments")
  listPayments(@Query() query: AdminPaymentsQueryDto) {
    return this.admin.listPayments(query);
  }

  @Roles("admin")
  @Get("audit-logs")
  listAuditLogs(@Query() query: AdminAuditLogsQueryDto) {
    return this.admin.listAuditLogs(query);
  }

  @Roles("admin")
  @Post("tutors/:id/status")
  setTutorStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: TutorStatusDto,
  ) {
    return this.admin.setTutorStatus(user.userId, id, dto);
  }

  @Roles("admin")
  @Post("reviews/:id/moderate")
  moderateReview(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.admin.moderateReview(user.userId, id, dto);
  }

  @Roles("admin")
  @Post("media/:id/moderate")
  moderateMedia(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ModerateMediaDto,
  ) {
    return this.admin.moderateMedia(user.userId, id, dto);
  }

  @Roles("admin")
  @Post("refunds")
  refund(@CurrentUser() user: AuthUser, @Body() dto: RefundDto) {
    return this.admin.refund(user.userId, dto);
  }
}
