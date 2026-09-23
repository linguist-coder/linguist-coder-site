// Google Analytics 4 setup. Kept in a file (not inline) so the Content-Security-Policy needs no 'unsafe-inline' for scripts.
// EEA, UK and Switzerland: no analytics cookies by default (this site shows no consent banner).
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']
});
gtag('set', 'ads_data_redaction', true);
gtag('js', new Date());
gtag('config', 'G-W5R5VM5C4L');
