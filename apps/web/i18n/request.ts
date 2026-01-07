import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Romanian is the only locale - no detection needed
  const locale = 'ro';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
