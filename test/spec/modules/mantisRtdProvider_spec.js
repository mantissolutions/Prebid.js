import { mantisDataModule } from 'modules/mantisRtdProvider.js';
import * as mantisModule from 'modules/mantisRtdProvider.js';
import sinon from 'sinon';
import * as utils from 'src/utils.js';
import { expect } from 'chai';

describe('mantisDataModule', function () {
  const configWithParams = {
    name: 'mantis',
    waitForIt: true,
    params:
    {
      endpoint: 'https://mantis.example.com',
      username: 'user',
      password: 'pass',
      timeout: 1000,
      filterThreshold: 0.6
    }
  };

  describe('mantisDataModule.init()', function () {
    let logErrorStub;
    let logMessageStub;

    beforeEach(function () {
      logErrorStub = sinon.stub(utils, 'logError');
      logMessageStub = sinon.stub(utils, 'logMessage');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should initialise and return true', function () {
      expect(mantisDataModule.init(configWithParams)).to.equal(true)
      sinon.assert.calledOnce(logMessageStub);
      sinon.assert.notCalled(logErrorStub);
    })

    it('should return false when params is missing or invalid', function () {
      const moduleConfig = configWithParams;
      moduleConfig.params = null;
      const result = mantisDataModule.init(moduleConfig);
      expect(result).to.equal(false);
      sinon.assert.calledOnce(logErrorStub);
      sinon.assert.notCalled(logMessageStub);
    })

    it('should return false when required parameters are missing', function () {
      const moduleConfig = configWithParams;
      moduleConfig.params = {
        endpoint: 'http://example.com',
        username: 'admin',
        // password missing
      };
      const result = mantisDataModule.init(moduleConfig);
      expect(result).to.equal(false);
      sinon.assert.calledOnce(logErrorStub);
      sinon.assert.notCalled(logMessageStub);
    });
  })

  describe('mantisDataModule.getBidRequestData()', function () {
    let reqBidsConfigObj;
    let onDoneSpy;
    let logWarnStub;
    let fetchStub;
    let logInfoStub;
    let logErrorStub;
    let logMessageStub;

    beforeEach(function () {
      reqBidsConfigObj = {
        adUnits: [{ code: 'adunit1' }],
        ortb2Fragments: {
          global: {}
        }
      };
      onDoneSpy = sinon.spy();
      logWarnStub = sinon.stub(utils, 'logWarn');
      logInfoStub = sinon.stub(utils, 'logInfo');
      logErrorStub = sinon.stub(utils, 'logError');
      fetchStub = sinon.stub(window, 'fetch');
      sinon.stub(mantisModule, 'processMantisData');
      sinon.stub(mantisModule, 'getMantisKeysSegmentData');
      sinon.stub(mantisModule, 'setOrtb2FromResponse');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should call onDone immediately if required params are missing', function () {
      mantisDataModule.getBidRequestData(reqBidsConfigObj, onDoneSpy, { params: {} });
      expect(onDoneSpy.calledOnce).to.equal(true);
      sinon.assert.calledOnce(logWarnStub);
      expect(fetchStub.called).to.equal(false);
    });

    it('should fetch data and set ortb2 segments successfully', function () {
      const apiResponse = { foo: 'bar' };
      const processedData = { processed: true };
      const mantisSegments = [{ id: 'seg-1' }];

      fetchStub.resolves({
        json: () => Promise.resolve(apiResponse)
      });

      mantisModule.processMantisData.returns(processedData);
      mantisModule.getMantisKeysSegmentData.returns(mantisSegments);
      mantisModule.setOrtb2FromResponse.returns(true);
      mantisDataModule.getBidRequestData(reqBidsConfigObj, onDoneSpy, configWithParams);

      Promise.resolve().then(() => Promise.resolve()).then(() => {
        expect(fetchStub.calledOnce).to.equal(true);
        expect(mantisModule.processMantisData.calledOnce).to.equal(true);
        expect(mantisModule.getMantisKeysSegmentData.calledOnce).to.equal(true);
        expect(mantisModule.setOrtb2FromResponse.calledOnce).to.equal(true);
        expect(onDoneSpy.notCalled).to.equal(true);
      });
    });

    it('should call onDone when mantis segments are empty', function () {
      const apiResponse = { foo: 'bar' };

      fetchStub.resolves({
        json: () => Promise.resolve(apiResponse)
      });

      mantisModule.processMantisData.returns({});
      mantisModule.getMantisKeysSegmentData.returns([]);
      mantisDataModule.getBidRequestData(reqBidsConfigObj, onDoneSpy, configWithParams);

      Promise.resolve()
        .then(() => {
          expect(onDoneSpy.calledOnce).to.equal(true);
          expect(mantisModule.setOrtb2FromResponse.notCalled).to.equal(true);
          sinon.assert.calledOnce(logInfoStub);
        });
    });

    it('should log error if setting ortb2 data fails', function () {
      fetchStub.resolves({
        json: () => Promise.resolve({})
      });

      mantisModule.processMantisData.returns({});
      mantisModule.getMantisKeysSegmentData.returns([{ id: 'seg-1' }]);
      mantisModule.setOrtb2FromResponse.returns(false);
      mantisDataModule.getBidRequestData(reqBidsConfigObj, onDoneSpy, configWithParams);

      Promise.resolve()
        .then(() => {
          sinon.assert.calledOnce(logErrorStub);
          expect(onDoneSpy.notCalled).to.equal(true);
        });
    });

    it('should call onDone when fetch rejects', function () {
      fetchStub.rejects(new Error('Network error'));

      mantisDataModule.getBidRequestData(reqBidsConfigObj, onDoneSpy, configWithParams);

      Promise.resolve()
        .then(() => {
          expect(onDoneSpy.calledOnce).to.equal(true);
          sinon.assert.calledOnce(logErrorStub);
        });
    });
  })

  describe('mantisModule.setOrtb2FromResponse', () => {
    let reqBidsConfigObj;
    let mergeDeepStub;
    let logMessageStub;

    beforeEach(() => {
      reqBidsConfigObj = {
        ortb2Fragments: {
          global: {}
        }
      };

      mergeDeepStub = sinon.stub(utils, 'mergeDeep');
      logMessageStub = sinon.stub(utils, 'logMessage');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should return false if ortb2StructuredData is null', () => {
      const result = mantisModule.setOrtb2FromResponse(reqBidsConfigObj, null);

      expect(result).to.equal(false);
      expect(mergeDeepStub.notCalled).to.equal(true);
    });

    it('should return false if ortb2StructuredData is not an object', () => {
      const result = mantisModule.setOrtb2FromResponse(reqBidsConfigObj, 'invalid');

      expect(result).to.equal(false);
      expect(mergeDeepStub.notCalled).to.equal(true);
    });

    it('should merge site and ext data into global ortb2', () => {
      const ortb2StructuredData = {
        site: { domain: 'example.com' },
        ext: { test: 1 }
      };

      const result = mantisModule.setOrtb2FromResponse(reqBidsConfigObj, ortb2StructuredData);

      expect(result).to.equal(true);

      expect(mergeDeepStub.calledWith(
        reqBidsConfigObj.ortb2Fragments.global,
        { site: ortb2StructuredData.site }
      )).to.equal(true);

      expect(mergeDeepStub.calledWith(
        reqBidsConfigObj.ortb2Fragments.global,
        { ext: ortb2StructuredData.ext }
      )).to.equal(true);

      expect(logMessageStub.calledOnce).to.equal(true);
    });

    it('should merge user data into global ortb2', () => {
      const ortb2StructuredData = {
        user: { id: 'user123' }
      };

      const result = mantisModule.setOrtb2FromResponse(reqBidsConfigObj, ortb2StructuredData);

      expect(result).to.equal(true);

      expect(mergeDeepStub.calledWith(
        reqBidsConfigObj.ortb2Fragments.global,
        { user: ortb2StructuredData.user }
      )).to.equal(true);
    });

    it('should merge both site and user data when present', () => {
      const ortb2StructuredData = {
        site: { page: 'https://example.com' },
        ext: { consent: 'abc' },
        user: { buyeruid: '12345' }
      };

      const result = mantisModule.setOrtb2FromResponse(reqBidsConfigObj, ortb2StructuredData);

      expect(result).to.equal(true);
      expect(mergeDeepStub.callCount).to.equal(3);
    });

    it('should not fail if ext is missing but site exists', () => {
      const ortb2StructuredData = {
        site: { domain: 'example.com' }
      };

      const result = mantisModule.setOrtb2FromResponse(reqBidsConfigObj, ortb2StructuredData);

      expect(result).to.equal(true);
      expect(mergeDeepStub.callCount).to.equal(2);
    });
  });

  describe('mantisModule.processMantisData', () => {
    it('should process full valid mantis data correctly', () => {
      const mantisData = {
        emotion: {
          happy: { level: 'high' },
          sad: { level: 'low' },
        },
        sentiment: 'positive',
        ratings: [
          { customer: 'amazon', rating: 'GREEN' },
          { customer: 'google', rating: 'RED' },
        ],
        categories: {
          mantis: [
            { label: 'sports', score: 0.8 },
            { label: 'crime', score: 0.4 },
          ],
          iab: [
            { id: 'IAB1', score: 0.9 },
            { id: 'IAB2', score: 0.3 },
          ],
        },
      };

      const result = mantisModule.processMantisData(mantisData);
      const mantis = result.standard.mantis;

      expect(mantis).to.contain('amazon-GREEN');
      expect(mantis).to.contain('google-RED');
      expect(mantis).to.contain('sentiment-positive');
      expect(mantis).to.contain('happy-high');
      expect(mantis).to.contain('sad-low');
      expect(mantis).to.contain('client-side');

      expect(result.standard.mantis_context).to.equal('sports');
      expect(result.standard.iab_context).to.equal('IAB1');
    });

    it('should default emotions to emotions-unknown when emotion object is empty', () => {
      const mantisData = {
        emotion: {},
        sentiment: 'neutral',
        ratings: [{ customer: 'amazon', rating: 'GREEN' }],
        categories: {},
      };

      const result = mantisModule.processMantisData(mantisData);

      expect(result.standard.mantis).contain('emotions-unknown');
    });

    it('should treat unknown emotion key correctly', () => {
      const mantisData = {
        emotion: {
          unknown: { level: 'medium' },
        },
      };

      const result = mantisModule.processMantisData(mantisData);

      expect(result.standard.mantis).contain('emotions-unknown');
    });

    it('should fallback to sentiment-unknown if sentiment is missing', () => {
      const mantisData = {
        emotion: {
          angry: { level: 'high' },
        },
      };

      const result = mantisModule.processMantisData(mantisData);

      expect(result.standard.mantis).contain('sentiment-unknown');
    });

    it('should skip ratings with N/A value', () => {
      const mantisData = {
        ratings: [
          { customer: 'amazon', rating: 'N/A' },
          { customer: 'google', rating: 'GREEN' },
        ],
      };

      const result = mantisModule.processMantisData(mantisData);

      expect(result.standard.mantis).contain('google-GREEN');
      expect(result.standard.mantis).not.contain('amazon');
    });

    it('should fallback ratings to unknown if no valid ratings exist', () => {
      const mantisData = {
        ratings: [{ customer: 'amazon', rating: 'N/A' }],
      };

      const result = mantisModule.processMantisData(mantisData);

      expect(result.standard.mantis.startsWith('unknown')).to.equal(true);
    });

    it('should return unknown for mantis_context and iab_context if scores are below threshold', () => {
      const mantisData = {
        categories: {
          mantis: [{ label: 'politics', score: 0.2 }],
          iab: [{ id: 'IAB5', score: 0.5 }],
        },
      };

      const result = mantisModule.processMantisData(mantisData);

      expect(result.standard.mantis_context).to.equal('unknown');
      expect(result.standard.iab_context).to.equal('unknown');
    });

    it('should handle empty input safely', () => {
      const result = mantisModule.processMantisData();

      expect(result).to.deep.equal({
        standard: {
          mantis: 'unknown,sentiment-unknown,emotions-unknown,client-side',
          mantis_context: 'unknown',
          iab_context: 'unknown',
        },
      });
    });
  });

  describe('mantisModule.buildApiUrl', () => {
    const endpoint = 'https://api.example.com/analyze';

    it('should build API URL without uuid', () => {
      const result = mantisModule.buildApiUrl(endpoint);
      expect(result).to.include(endpoint + '?');
      expect(result).to.include(
        'filter=fullRatings,input,findings,sentiment,emotion,categories'
      );
      expect(result).to.include('&url=');
      expect(result).to.not.include('uuid=');
    });
  });
})
