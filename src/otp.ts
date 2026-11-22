/** Email OTP is deliberately six digits; never accept a partial or longer code. */
export const isOtpCode=(value:string)=>/^[0-9]{6}$/.test(value);
export const normalizeOtpInput=(value:string)=>value.replace(/[^0-9]/g,'').slice(0,6);
