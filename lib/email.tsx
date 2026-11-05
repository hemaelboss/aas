export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "noreply@yourdomain.com",
      to: [to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send email: ${error}`)
  }

  return await response.json()
}

export function getSubscriptionStartEmailTemplate(customerName: string, accountName: string, endDate: string) {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">مرحباً بك في الاشتراك</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">عزيزي/عزيزتي <strong>${customerName}</strong>،</p>
        <p style="font-size: 16px;">تم تفعيل اشتراكك في <strong>${accountName}</strong> بنجاح!</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>تاريخ انتهاء الاشتراك:</strong> ${new Date(endDate).toLocaleDateString("ar-SA")}</p>
        </div>
        <p style="font-size: 14px; color: #666;">شكراً لثقتك بنا. نتمنى لك تجربة ممتعة!</p>
      </div>
    </body>
    </html>
  `
}

export function getSubscriptionExpiryEmailTemplate(customerName: string, accountName: string, endDate: string) {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">تنبيه انتهاء الاشتراك</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">عزيزي/عزيزتي <strong>${customerName}</strong>،</p>
        <p style="font-size: 16px;">نود إعلامك بأن اشتراكك في <strong>${accountName}</strong> على وشك الانتهاء.</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #f5576c;">
          <p style="margin: 10px 0;"><strong>تاريخ الانتهاء:</strong> ${new Date(endDate).toLocaleDateString("ar-SA")}</p>
        </div>
        <p style="font-size: 14px; color: #666;">يرجى التواصل معنا لتجديد اشتراكك والاستمرار في الاستفادة من الخدمة.</p>
      </div>
    </body>
    </html>
  `
}

export function getSubscriptionRenewalEmailTemplate(customerName: string, accountName: string, newEndDate: string) {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">تم تجديد اشتراكك</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">عزيزي/عزيزتي <strong>${customerName}</strong>،</p>
        <p style="font-size: 16px;">تم تجديد اشتراكك في <strong>${accountName}</strong> بنجاح!</p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>تاريخ الانتهاء الجديد:</strong> ${new Date(newEndDate).toLocaleDateString("ar-SA")}</p>
        </div>
        <p style="font-size: 14px; color: #666;">شكراً لتجديد ثقتك بنا!</p>
      </div>
    </body>
    </html>
  `
}
