/**
 * Email Signature Template Generator
 * Generates HTML email signatures matching Bojin Attorneys branding
 */

export interface SignatureData {
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
  email: string;
}

const OFFICE_ADDRESS = 'Piața Ionel I.C. Brătianu nr. 1, birou 13, Timișoara';
// Use window location in browser, fallback to production URL
const LOGO_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/signature-logo.svg`
    : 'https://app.bojin-law.com/signature-logo.svg';

/**
 * Generates an HTML email signature matching the Bojin Attorneys design
 * Uses tables for maximum email client compatibility
 */
export function generateSignatureHtml(data: SignatureData): string {
  const fullName = `${data.firstName} ${data.lastName}`.toUpperCase();

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #282828; max-width: 550px;">
  <tr>
    <td style="vertical-align: middle; padding-right: 20px; width: 180px;">
      <img src="${LOGO_URL}" alt="Bojin Attorneys" width="180" height="36" style="display: block;" />
    </td>
    <td style="vertical-align: middle; border-left: 2px solid #a50000; padding-left: 20px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family: 'Arial Narrow', Arial, sans-serif; font-size: 22px; font-weight: bold; color: #282828; letter-spacing: 3px; padding-bottom: 4px;">
            ${fullName}
          </td>
        </tr>
        <tr>
          <td style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; padding-bottom: 12px;">
            ${data.title}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px;">
            <div style="width: 100%; height: 1px; background-color: #a50000;"></div>
          </td>
        </tr>
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #282828;">
              <tr>
                <td style="padding-bottom: 4px; vertical-align: middle; width: 20px;">
                  <img src="https://app.bojin-law.com/icons/phone.png" alt="" width="14" height="14" style="display: block;" />
                </td>
                <td style="padding-bottom: 4px; padding-left: 8px;">
                  <a href="tel:${data.phone.replace(/[^+\d]/g, '')}" style="color: #282828; text-decoration: none;">${data.phone}</a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 4px; vertical-align: middle; width: 20px;">
                  <img src="https://app.bojin-law.com/icons/email.png" alt="" width="14" height="14" style="display: block;" />
                </td>
                <td style="padding-bottom: 4px; padding-left: 8px;">
                  <a href="mailto:${data.email}" style="color: #282828; text-decoration: none;">${data.email}</a>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 20px; padding-top: 2px;">
                  <img src="https://app.bojin-law.com/icons/location.png" alt="" width="14" height="14" style="display: block;" />
                </td>
                <td style="padding-left: 8px;">
                  ${OFFICE_ADDRESS}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Generates signature HTML using Unicode symbols instead of icon images
 * More compatible fallback version
 */
export function generateSignatureHtmlSimple(data: SignatureData): string {
  const fullName = `${data.firstName} ${data.lastName}`.toUpperCase();

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #282828; max-width: 550px;">
  <tr>
    <td style="vertical-align: middle; padding-right: 20px; width: 180px;">
      <img src="${LOGO_URL}" alt="Bojin Attorneys" width="180" height="36" style="display: block;" />
    </td>
    <td style="vertical-align: middle; border-left: 2px solid #a50000; padding-left: 20px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family: 'Arial Narrow', Arial, sans-serif; font-size: 22px; font-weight: bold; color: #282828; letter-spacing: 3px; padding-bottom: 4px;">
            ${fullName}
          </td>
        </tr>
        <tr>
          <td style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; padding-bottom: 12px;">
            ${data.title}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 10px;">
            <div style="width: 100%; height: 1px; background-color: #a50000;"></div>
          </td>
        </tr>
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #282828;">
              <tr>
                <td style="padding-bottom: 4px; vertical-align: middle; width: 20px; font-size: 14px;">&#128222;</td>
                <td style="padding-bottom: 4px; padding-left: 8px;">
                  <a href="tel:${data.phone.replace(/[^+\d]/g, '')}" style="color: #282828; text-decoration: none;">${data.phone}</a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 4px; vertical-align: middle; width: 20px; font-size: 14px;">&#9993;</td>
                <td style="padding-bottom: 4px; padding-left: 8px;">
                  <a href="mailto:${data.email}" style="color: #282828; text-decoration: none;">${data.email}</a>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 20px; padding-top: 2px; font-size: 14px;">&#128205;</td>
                <td style="padding-left: 8px;">
                  ${OFFICE_ADDRESS}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
