import { parseOSDJson } from '../src/parsers/osd';
import { parseSimpleJson } from '../src/parsers/simple';
import { SoilProfile } from '../src/core/SoilProfile';
import { SoilProfileCollection } from '../src/core/SoilProfileCollection';
import { Horizon } from '../src/core/types';
import { DelimitedOptions } from '../src/parsers/delimited';

// Interface for the dynamically imported delimited parser module
interface DelimitedModule {
  parseDelimitedHorizons: (data: string, options?: DelimitedOptions) => Horizon[];
  parseDelimitedProfile: (data: string, profileId: string, options?: DelimitedOptions) => SoilProfile;
}

// Import delimiter parser if available (W2.1 may not be complete yet)
let parseDelimitedHorizons: (data: string, options?: DelimitedOptions) => Horizon[];
let parseDelimitedProfile: (data: string, profileId: string, options?: DelimitedOptions) => SoilProfile;
let delimitedParserAvailable = false;

try {
  const delimited = require('../src/parsers/delimited');
  parseDelimitedHorizons = delimited.parseDelimitedHorizons;
  parseDelimitedProfile = delimited.parseDelimitedProfile;
  delimitedParserAvailable = true;
} catch (e) {
  // W2.1 not complete yet; delimiter tests will be skipped
}

describe('Parser Test Suite', () => {
  // =============================================================================
  // OSD JSON Parser Tests (W1.1)
  // =============================================================================

  describe('OSD JSON Parser (parseOSDJson)', () => {
    it('happy path: valid OSD document with multiple horizons', () => {
      const osdDoc = {
        SERIES: 'Mollisol',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            moist_hue: '10YR',
            moist_value: 3,
            moist_chroma: 2,
            texture_class: 'loam'
          },
          {
            name: 'B',
            top: 20,
            bottom: 50,
            moist_hue: '7.5YR',
            moist_value: 4,
            moist_chroma: 4,
            texture_class: 'clay loam',
            pH_class: 'slightly acid'
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile).toBeInstanceOf(SoilProfile);
      expect(profile.id).toBe('Mollisol');
      expect(profile.horizons.length).toBe(2);
      expect(profile.horizons[0].name).toBe('A');
      expect(profile.horizons[0].top).toBe(0);
      expect(profile.horizons[0].bottom).toBe(20);
      expect(profile.horizons[0].texture).toBe('loam');
      expect(profile.horizons[1].name).toBe('B');
      expect(profile.horizons[1].metadata?.pH_class).toBe('slightly acid');
    });

    it('happy path: single horizon OSD document', () => {
      const osdDoc = {
        SERIES: 'Alfisol',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 15,
            moist_hue: '5YR',
            moist_value: 5,
            moist_chroma: 3
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.id).toBe('Alfisol');
      expect(profile.horizons.length).toBe(1);
      expect(profile.horizons[0].top).toBe(0);
      expect(profile.horizons[0].bottom).toBe(15);
    });

    it('missing HORIZONS array returns empty profile', () => {
      const osdDoc = {
        SERIES: 'TestSeries'
        // No HORIZONS field
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.id).toBe('TestSeries');
      expect(profile.horizons.length).toBe(0);
    });

    it('HORIZONS not array returns empty profile', () => {
      const osdDoc = {
        SERIES: 'BadHorizons',
        HORIZONS: null
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.id).toBe('BadHorizons');
      expect(profile.horizons.length).toBe(0);
    });

    it('invalid horizon (top >= bottom) is skipped with warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const osdDoc = {
        SERIES: 'TestSeries',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            moist_hue: '10YR',
            moist_value: 3,
            moist_chroma: 2
          },
          {
            name: 'B',
            top: 50,
            bottom: 50, // Invalid: top >= bottom
            moist_hue: '7.5YR',
            moist_value: 4,
            moist_chroma: 4
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.horizons.length).toBe(1);
      expect(profile.horizons[0].name).toBe('A');
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain('invalid depth');

      warnSpy.mockRestore();
    });

    it('all invalid horizons returns empty profile', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const osdDoc = {
        SERIES: 'AllBad',
        HORIZONS: [
          {
            name: 'A',
            top: 20,
            bottom: 20 // Invalid
          },
          {
            name: 'B',
            top: 50,
            bottom: 40 // Invalid: inverted
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.horizons.length).toBe(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('Munsell color generation from valid moist_hue/value/chroma', () => {
      const osdDoc = {
        SERIES: 'MunsellTest',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 15,
            moist_hue: '10YR',
            moist_value: 4,
            moist_chroma: 3
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.horizons[0].color).toBeTruthy();
      expect(profile.horizons[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('fallback color on invalid Munsell data', () => {
      const osdDoc = {
        SERIES: 'NoMunsell',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 15,
            // No Munsell data
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.horizons[0].color).toBe('#cccccc');
    });

    it('fallback color on invalid moist_value', () => {
      const osdDoc = {
        SERIES: 'InvalidValue',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 15,
            moist_hue: '10YR',
            moist_value: NaN,
            moist_chroma: 3
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.horizons[0].color).toBe('#cccccc');
    });

    it('SERIES name used as profile ID', () => {
      const osdDoc = {
        SERIES: 'MyUniqueSeriesName',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 15,
            moist_hue: '10YR',
            moist_value: 3,
            moist_chroma: 2
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.id).toBe('MyUniqueSeriesName');
    });

    it('extensible metadata: extra OSD fields are captured in horizon.metadata', () => {
      const osdDoc = {
        SERIES: 'ExtensibleTest',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            moist_hue: '10YR',
            moist_value: 3,
            moist_chroma: 2,
            texture_class: 'loam',
            consistence: 'friable',
            pH_class: 'slightly acid',
            structure: 'weak medium granular'
          }
        ]
      };

      const profile = parseOSDJson(osdDoc);

      expect(profile.horizons.length).toBe(1);
      expect(profile.horizons[0].metadata?.consistence).toBe('friable');
      expect(profile.horizons[0].metadata?.pH_class).toBe('slightly acid');
      expect(profile.horizons[0].metadata?.structure).toBe('weak medium granular');
    });
  });

  // =============================================================================
  // Simple JSON Parser Tests (W1.2)
  // =============================================================================

  describe('Simple JSON Parser (parseSimpleJson)', () => {
    it('happy path: valid input with multiple horizons and optional fields', () => {
      const data = {
        id: 'PROFILE_1',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            color: '#8B7355',
            texture: 'loam',
            clay: 18,
            sand: 42,
            silt: 40,
            ph: 6.2
          },
          {
            name: 'B',
            top: 20,
            bottom: 50,
            color: '#A0826D',
            texture: 'clay loam',
            clay: 35,
            sand: 30,
            silt: 35,
            om: 1.2
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile).toBeInstanceOf(SoilProfile);
      expect(profile.id).toBe('PROFILE_1');
      expect(profile.horizons.length).toBe(2);
      expect(profile.horizons[0].name).toBe('A');
      expect(profile.horizons[0].clay).toBe(18);
      expect(profile.horizons[1].name).toBe('B');
      expect(profile.horizons[1].om).toBe(1.2);
    });

    it('happy path: minimal required fields only', () => {
      const data = {
        id: 'MINIMAL',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            color: '#8B7355'
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.id).toBe('MINIMAL');
      expect(profile.horizons.length).toBe(1);
      expect(profile.horizons[0].texture).toBeUndefined();
      expect(profile.horizons[0].clay).toBeUndefined();
    });

    it('missing id throws Error', () => {
      const data = {
        horizons: [{ name: 'A', top: 0, bottom: 20, color: '#8B7355' }]
      };

      expect(() => parseSimpleJson(data)).toThrow('id is required');
    });

    it('missing horizons array throws Error', () => {
      const data = {
        id: 'NO_HORIZONS'
      };

      expect(() => parseSimpleJson(data)).toThrow('horizons array is required');
    });

    it('numeric string coercion: string depths become numbers', () => {
      const data = {
        id: 'STRING_DEPTHS',
        horizons: [
          {
            name: 'A',
            top: '0',
            bottom: '20',
            color: '#8B7355'
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(typeof profile.horizons[0].top).toBe('number');
      expect(typeof profile.horizons[0].bottom).toBe('number');
      expect(profile.horizons[0].top).toBe(0);
      expect(profile.horizons[0].bottom).toBe(20);
    });

    it('invalid depth (top >= bottom) is skipped with warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const data = {
        id: 'INVALID_DEPTH',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            color: '#8B7355'
          },
          {
            name: 'B',
            top: 50,
            bottom: 50,
            color: '#A0826D'
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons.length).toBe(1);
      expect(profile.horizons[0].name).toBe('A');
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('empty horizons array is valid', () => {
      const data = {
        id: 'EMPTY',
        horizons: []
      };

      const profile = parseSimpleJson(data);

      expect(profile.id).toBe('EMPTY');
      expect(profile.horizons.length).toBe(0);
    });

    it('missing required horizon field (name) skips horizon', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const data = {
        id: 'NO_NAME',
        horizons: [
          {
            top: 0,
            bottom: 20,
            color: '#8B7355'
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons.length).toBe(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('missing color field skips horizon', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const data = {
        id: 'NO_COLOR',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons.length).toBe(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('all invalid horizons returns empty profile', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const data = {
        id: 'ALL_INVALID',
        horizons: [
          { top: 0, bottom: 20, color: '#8B7355' }, // missing name
          { name: 'B', top: 50, bottom: 50, color: '#A0826D' } // invalid depth
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons.length).toBe(0);

      warnSpy.mockRestore();
    });

    it('numeric string coercion for optional fields', () => {
      const data = {
        id: 'COERCE_OPTIONAL',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            color: '#8B7355',
            clay: '25',
            sand: '50',
            ph: '6.5'
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons[0].clay).toBe(25);
      expect(profile.horizons[0].sand).toBe(50);
      expect(profile.horizons[0].ph).toBe(6.5);
    });

    it('preserves Munsell color fields', () => {
      const data = {
        id: 'MUNSELL',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            color: '#8B7355',
            munsellHue: '10YR',
            munsellValue: 4,
            munsellChroma: 3
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons[0].munsellHue).toBe('10YR');
      expect(profile.horizons[0].munsellValue).toBe(4);
      expect(profile.horizons[0].munsellChroma).toBe(3);
    });

    it('extensible extra fields: unknown fields stored in horizon.extra', () => {
      const data = {
        id: 'EXTRA_FIELDS',
        horizons: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            color: '#8B7355',
            clay: 18,
            customField: 'custom_value',
            specialNote: 'important note',
            numericExtra: 42
          }
        ]
      };

      const profile = parseSimpleJson(data);

      expect(profile.horizons[0].extra).toBeDefined();
      expect(profile.horizons[0].extra?.customField).toBe('custom_value');
      expect(profile.horizons[0].extra?.specialNote).toBe('important note');
      expect(profile.horizons[0].extra?.numericExtra).toBe(42);
      // Verify known field is not in extra
      expect(profile.horizons[0].extra?.clay).toBeUndefined();
      // Verify known field is in correct place
      expect(profile.horizons[0].clay).toBe(18);
    });
  });

  // =============================================================================
  // Delimiter Parser Tests (W2.1 — conditional, may skip if not available)
  // =============================================================================

  if (delimitedParserAvailable) {
    describe('Delimiter Parser (parseDelimitedHorizons / parseDelimitedProfile)', () => {
      it('happy path: CSV with header row', () => {
        const csvData = `name,top,bottom,color,texture,clay
A,0,20,#8B7355,loam,18
B,20,50,#A0826D,clay loam,35`;

        const horizons = parseDelimitedHorizons(csvData, {
          delimiter: ',',
          hasHeader: true
        });

        expect(horizons.length).toBe(2);
        expect(horizons[0].name).toBe('A');
        expect(horizons[0].top).toBe(0);
        expect(horizons[0].bottom).toBe(20);
        expect(horizons[0].clay).toBe(18);
        expect(horizons[1].name).toBe('B');
        expect(horizons[1].clay).toBe(35);
      });

      it('pipe-delimited variant', () => {
        const pipeData = `name|top|bottom|color|texture
A|0|20|#8B7355|loam
B|20|50|#A0826D|clay loam`;

        const horizons = parseDelimitedHorizons(pipeData, {
          delimiter: '|',
          hasHeader: true
        });

        expect(horizons.length).toBe(2);
        expect(horizons[0].texture).toBe('loam');
        expect(horizons[1].texture).toBe('clay loam');
      });

      it('tab-delimited variant', () => {
        const tabData = `name\ttop\tbottom\tcolor\nA\t0\t20\t#8B7355\nB\t20\t50\t#A0826D`;

        const horizons = parseDelimitedHorizons(tabData, {
          delimiter: '\t',
          hasHeader: true
        });

        expect(horizons.length).toBe(2);
        expect(horizons[0].name).toBe('A');
        expect(horizons[1].name).toBe('B');
      });

      it('no header row: without header, columns mapped to col_0, col_1, etc. (depths not found)', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const data = `A,0,20,#8B7355,loam
B,20,50,#A0826D,clay loam`;

        // Without header, columns are mapped to col_0, col_1, etc.
        // Parser looks for 'top' and 'bottom' fields, which don't exist
        // So all rows are skipped with warnings
        const horizons = parseDelimitedHorizons(data, {
          delimiter: ',',
          hasHeader: false
        });

        expect(horizons.length).toBe(0);
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });

      it('numeric coercion for depth and soil properties', () => {
        const csvData = `name,top,bottom,color,clay,sand,ph
A,0,20,#8B7355,15,60,6.5
B,20,50,#A0826D,35,40,6.2`;

        const horizons = parseDelimitedHorizons(csvData, {
          delimiter: ',',
          hasHeader: true
        });

        expect(typeof horizons[0].top).toBe('number');
        expect(typeof horizons[0].clay).toBe('number');
        expect(typeof horizons[0].ph).toBe('number');
        expect(horizons[0].ph).toBe(6.5);
      });

      it('field alias mapping: hzname → name, hzdept_r → top, hzdepb_r → bottom', () => {
        const csvData = `hzname,hzdept_r,hzdepb_r,color,claytotal_r
Ap,0,20,#8B7355,15
B,20,50,#A0826D,35`;

        const horizons = parseDelimitedHorizons(csvData, {
          delimiter: ',',
          hasHeader: true
        });

        // After mapping: hzname → name, hzdept_r → top, hzdepb_r → bottom, claytotal_r → clay
        expect(horizons[0].name).toBe('Ap');
        expect(horizons[0].top).toBe(0);
        expect(horizons[0].bottom).toBe(20);
        expect(horizons[0].clay).toBe(15);
      });

      it('invalid depth in row is skipped with warning', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const csvData = `name,top,bottom,color
A,0,20,#8B7355
B,50,50,#A0826D
C,50,60,#CCCCCC`;

        const horizons = parseDelimitedHorizons(csvData, {
          delimiter: ',',
          hasHeader: true
        });

        // B should be skipped (top >= bottom), only A and C remain
        expect(horizons.length).toBe(2);
        expect(horizons[0].name).toBe('A');
        expect(horizons[1].name).toBe('C');
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
      });

      it('missing color field skips horizon and warns', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const csvData = `name,top,bottom,color
A,0,20,`;

        const horizons = parseDelimitedHorizons(csvData, {
          delimiter: ',',
          hasHeader: true
        });

        expect(horizons.length).toBe(0);
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy.mock.calls[0][0]).toContain('missing');

        warnSpy.mockRestore();
      });

      it('parseDelimitedProfile wrapper returns SoilProfile', () => {
        const csvData = `name,top,bottom,color
A,0,20,#8B7355
B,20,50,#A0826D`;

        const profile = parseDelimitedProfile(csvData, 'TEST_PROFILE', {
          delimiter: ',',
          hasHeader: true
        });

        expect(profile).toBeInstanceOf(SoilProfile);
        expect(profile.id).toBe('TEST_PROFILE');
        expect(profile.horizons.length).toBe(2);
      });

      it('extensible extra fields: unknown columns stored in horizon.extra', () => {
        const csvData = `name,top,bottom,color,clay,customField,specialNote
A,0,20,#8B7355,18,extra_data,field note
B,20,50,#A0826D,35,more data,another note`;

        const horizons = parseDelimitedHorizons(csvData, {
          delimiter: ',',
          hasHeader: true
        });

        expect(horizons.length).toBe(2);
        // Check first horizon
        expect(horizons[0].extra).toBeDefined();
        expect(horizons[0].extra?.customField).toBe('extra_data');
        expect(horizons[0].extra?.specialNote).toBe('field note');
        // Verify known field is not in extra
        expect(horizons[0].extra?.clay).toBeUndefined();
        // Verify known field is in correct place
        expect(horizons[0].clay).toBe(18);
        // Check second horizon
        expect(horizons[1].extra?.customField).toBe('more data');
        expect(horizons[1].extra?.specialNote).toBe('another note');
      });
    });
  } else {
    describe('Delimiter Parser (W2.1)', () => {
      it.skip('skipped: W2.1 (delimiter parser) not yet complete', () => {
        // This placeholder ensures the test suite structure is clear
        // Delimiter tests will be run once W2.1 is complete
      });
    });
  }

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('Integration: Parsers and SoilProfileCollection', () => {
    it('all parsers produce valid SoilProfile instances', () => {
      const osdProfile = parseOSDJson({
        SERIES: 'OSD_Profile',
        HORIZONS: [{ name: 'A', top: 0, bottom: 20, moist_hue: '10YR', moist_value: 3, moist_chroma: 2 }]
      });

      const simpleProfile = parseSimpleJson({
        id: 'Simple_Profile',
        horizons: [{ name: 'A', top: 0, bottom: 20, color: '#8B7355' }]
      });

      expect(osdProfile).toBeInstanceOf(SoilProfile);
      expect(simpleProfile).toBeInstanceOf(SoilProfile);
      expect(osdProfile.horizons.length).toBe(1);
      expect(simpleProfile.horizons.length).toBe(1);
    });

    it('SoilProfileCollection accepts parsed profiles from OSD and Simple parsers', () => {
      const osdProfile = parseOSDJson({
        SERIES: 'OSD1',
        HORIZONS: [{ name: 'A', top: 0, bottom: 30, moist_hue: '10YR', moist_value: 3, moist_chroma: 2 }]
      });

      const simpleProfile = parseSimpleJson({
        id: 'SIMPLE1',
        horizons: [{ name: 'A', top: 0, bottom: 25, color: '#8B7355' }]
      });

      const collection = new SoilProfileCollection([osdProfile, simpleProfile]);

      expect(collection.profiles.length).toBe(2);
      expect(collection.profiles[0].id).toBe('OSD1');
      expect(collection.profiles[1].id).toBe('SIMPLE1');
    });

    it('SoilProfileCollection methods work on parsed profiles', () => {
      const p1 = parseOSDJson({
        SERIES: 'P1',
        HORIZONS: [{ name: 'A', top: 0, bottom: 40, moist_hue: '10YR', moist_value: 3, moist_chroma: 2 }]
      });

      const p2 = parseSimpleJson({
        id: 'P2',
        horizons: [{ name: 'A', top: 0, bottom: 60, color: '#8B7355' }]
      });

      const collection = new SoilProfileCollection([p1, p2]);

      expect(collection.getMaxDepth()).toBe(60);

      const filtered = collection.filterByProperty((p) => p.id === 'P1');
      expect(filtered.profiles.length).toBe(1);
      expect(filtered.profiles[0].id).toBe('P1');
    });

    it('addProfile method works with parsed profiles', () => {
      const collection = new SoilProfileCollection();

      const profile = parseSimpleJson({
        id: 'ADDED',
        horizons: [{ name: 'A', top: 0, bottom: 20, color: '#8B7355' }]
      });

      collection.addProfile(profile);

      expect(collection.profiles.length).toBe(1);
      expect(collection.profiles[0].id).toBe('ADDED');
    });

    it('parsed profiles have expected properties', () => {
      const osdProfile = parseOSDJson({
        SERIES: 'TestOSD',
        HORIZONS: [
          {
            name: 'A',
            top: 0,
            bottom: 20,
            moist_hue: '10YR',
            moist_value: 3,
            moist_chroma: 2,
            texture_class: 'loam'
          }
        ]
      });

      const h = osdProfile.horizons[0];
      expect(h.top).toBe(0);
      expect(h.bottom).toBe(20);
      expect(h.name).toBe('A');
      expect(h.color).toBeTruthy();
      expect(h.texture).toBe('loam');
    });
  });
});
