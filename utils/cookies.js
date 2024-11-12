// Set each token part as an HttpOnly cookie
const setCookie = (res, tokenParts) => {
  // Define an expiration time based on JWT expiration
  const maxAge = Number(process.env.JWT_COOKIE_EXPIRE_TIME) * 24 * 60 * 60 * 1000;
  
  // Set each part in a separate HTTP-only, secure cookie
  Object.keys(tokenParts).forEach(partKey => {
    res.cookie(partKey, tokenParts[partKey], {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge,
    });
  });
};

module.exports = { setCookie };
