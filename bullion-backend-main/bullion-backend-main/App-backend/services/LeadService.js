const LeadModel = require('../Models/LeadModel');

module.exports = {
  getLeadPhoneNumbers,
  incrementReferralCountForLead
}

async function getLeadPhoneNumbers() {
  const leads = await LeadModel.distinct("phoneNumber", {})
  let enrichedLeads = []
  leads.forEach((lead) => {
    lead && enrichedLeads.push(lead.toString())
    lead && enrichedLeads.push('+91' + lead)
  })
  return { phoneLeads: enrichedLeads }
}

async function incrementReferralCountForLead(phoneNumber) {
  await LeadModel.findOneAndUpdate({ phoneNumber }, { referralCount: 1 })
}
