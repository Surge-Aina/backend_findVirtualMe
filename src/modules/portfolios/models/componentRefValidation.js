const mongoose = require("mongoose");
const { UserVoucher } = require("../../vouchers/userVoucher.model");
const { ComponentConfigError } = require("./componentSchemas");

function voucherNotFound(details) {
  const err = new Error("Voucher not found");
  err.name = "FeatureComponentsError";
  err.status = 404;
  err.code = "not_found";
  err.details = details;
  return err;
}

const FORBIDDEN_SOCIAL_LINK_KEYS = new Set([
  "links",
  "github",
  "twitter",
  "linkedin",
  "instagram",
  "website",
  "url",
  "href",
]);

function isObjectIdString(value) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value) && String(value).length === 24;
}

function assertNoEmbeddedSocialUrls(props = {}) {
  for (const key of Object.keys(props)) {
    if (FORBIDDEN_SOCIAL_LINK_KEYS.has(key)) {
      throw new ComponentConfigError(`Social link URLs must not be set via component props ("${key}")`, {
        code: "invalid_component_config",
        details: { field: key },
      });
    }
  }
  if (props.platforms && typeof props.platforms === "object") {
    for (const [platform, value] of Object.entries(props.platforms)) {
      if (typeof value === "string" && value.trim()) {
        throw new ComponentConfigError(
          `Platform "${platform}" must be a visibility flag, not a URL`,
          {
            code: "invalid_component_config",
            details: { field: `platforms.${platform}` },
          }
        );
      }
    }
  }
}

async function assertUserVoucherOwnedBySiteOwner(voucherRefId, ownerId) {
  if (!isObjectIdString(voucherRefId)) {
    throw new ComponentConfigError("voucherId must be a valid id", {
      code: "invalid_component_config",
      details: { field: "voucherId" },
    });
  }

  const record = await UserVoucher.findById(voucherRefId).select("userId status").lean();
  if (!record || String(record.userId) !== String(ownerId)) {
    throw voucherNotFound({ field: "voucherId" });
  }
}

/**
 * Async ownership / reference checks for slice-2 components (after sync prop validation).
 */
async function assertWritableComponentRefs(type, props, { ownerId }) {
  if (type === "SocialLinks") {
    assertNoEmbeddedSocialUrls(props || {});
    return;
  }

  if (type === "VoucherOffer") {
    const voucherRefId = props?.voucherId;
    if (voucherRefId) {
      await assertUserVoucherOwnedBySiteOwner(voucherRefId, ownerId);
    }
  }
}

module.exports = {
  assertWritableComponentRefs,
  assertNoEmbeddedSocialUrls,
  isObjectIdString,
};