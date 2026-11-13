import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Domains are stored bare (`kinesilk.cl`), never with a scheme or a trailing slash, because the
 * connector builds URLs from this value. The DTO is deliberately permissive about what a human
 * pastes in — `https://WWW.Kinesilk.cl/` is a normal thing to paste — and the service normalises
 * it before the strict shape is enforced.
 */
const DOMAIN_PATTERN_INPUT = /^(https?:\/\/)?(www\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\/?$/i;

export class CreateWebsiteDto {
  @IsString()
  @Matches(DOMAIN_PATTERN_INPUT, { message: 'domain_invalid' })
  domain!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'language_invalid' })
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  publishHour?: number;

  /** Only needed when the caller belongs to more than one account with write access. */
  @IsOptional()
  @IsString()
  accountId?: string;
}

export class UpdateWebsiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'language_invalid' })
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  publishHour?: number;
}

export class OverviewQueryDto {
  /** `YYYY-MM-DD`, interpreted in the website's own timezone. Defaults to today there. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date_invalid' })
  date?: string;
}
