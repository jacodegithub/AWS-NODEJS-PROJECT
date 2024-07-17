const Bree = require('bree');

const bree = new Bree({
  jobs: [{
    name: 'hourlyNotifications',
    cron: '5 * * * *',
  },
  {
    name: 'walletExpiryChecker',
    cron: '05 00 * * *',
  },
  {
    name: 'referralBonusEligibilityChecker',
    cron: '25 00 * * *',
  },
  {
    name: 'referralExpiryChecker',
    cron: '40 00 * * *',
  }],
});

const start = async () => {
  await bree.start();
}

module.exports = { start };
