const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationCode = async (to, code) => {
  await transporter.sendMail({
    from: `"实习生交流平台" <${process.env.EMAIL_FROM}>`,
    to,
    subject: '【实习生交流平台】注册验证码',
    html: `
      <div style="font-family: 'PingFang SC', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h2 style="color: #667eea; font-size: 24px; margin: 0;">实习生交流平台</h2>
          <p style="color: #6b7280; margin-top: 8px;">连接全行业实习生</p>
        </div>
        <div style="background: #f9fafb; border-radius: 12px; padding: 32px; text-align: center;">
          <p style="color: #374151; font-size: 15px; margin-bottom: 20px;">你的注册验证码为：</p>
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 16px 32px; display: inline-block;">
            <span style="font-size: 40px; font-weight: bold; color: #667eea; letter-spacing: 10px;">${code}</span>
          </div>
          <p style="color: #9ca3af; font-size: 13px; margin-top: 20px;">验证码 <strong>5分钟</strong> 内有效，请勿泄露给他人</p>
        </div>
        <p style="color: #d1d5db; font-size: 12px; text-align: center; margin-top: 24px;">
          如果你没有注册实习生交流平台，请忽略此邮件
        </p>
      </div>
    `,
  });
};

module.exports = { sendVerificationCode };
