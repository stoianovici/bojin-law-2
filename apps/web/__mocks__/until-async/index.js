// Mock for until-async ESM package
async function until(promise) {
  try {
    const data = await promise;
    return { error: null, data };
  } catch (error) {
    return { error, data: null };
  }
}

module.exports = { until };
