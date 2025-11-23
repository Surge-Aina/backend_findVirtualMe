// Mock OpenAI BEFORE importing
const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

const {
  generateMatchSummary,
  generatePortfolioJSON,
  generateVendorAboutAndMenuJSON,
} = require('../../services/openAiService');

describe('Project Manager - OpenAI Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });


  describe('generateMatchSummary', () => {
    const mockResumeJSON = {
      name: 'John Doe',
      title: 'Project Manager',
      skills: ['Agile', 'Scrum', 'Team Leadership'],
      experiences: [
        {
          company: 'Tech Corp',
          title: 'Senior PM',
          startDate: '2020-01-01',
          endDate: '2023-01-01',
          description: 'Led cross-functional teams',
        },
      ],
    };

    const mockJobText = `
      Looking for experienced Project Manager with:
      - 5+ years experience
      - Agile/Scrum expertise
      - Team leadership skills
      - PMP certification
    `;

    describe('✅ Success Cases', () => {
      it('should generate match summary for project manager resume', async () => {
        const mockResponse = {
          choices: [
            {
              message: {
                content: `
                  ✓ Matches: Agile, Scrum, Team Leadership
                  
                  ✗ Missing: PMP certification
                  
                  Summary: Strong PM candidate with relevant experience.
                `,
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateMatchSummary(mockResumeJSON, mockJobText);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('Match this resume to the job'),
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        });
        expect(result).toContain('✓ Matches');
        expect(result).toContain('✗ Missing');
      });

      it('should include complete resume data in prompt', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Match summary' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        await generateMatchSummary(mockResumeJSON, mockJobText);

        const callArgs = mockCreate.mock.calls[0][0];
        const promptContent = callArgs.messages[0].content;
        
        expect(promptContent).toContain(JSON.stringify(mockResumeJSON, null, 2));
        expect(promptContent).toContain(mockJobText);
      });

      it('should handle resume with multiple experiences', async () => {
        const multiExpResumeJSON = {
          ...mockResumeJSON,
          experiences: [
            { company: 'Company A', title: 'PM', years: 3 },
            { company: 'Company B', title: 'Senior PM', years: 2 },
          ],
        };

        const mockResponse = {
          choices: [{ message: { content: 'Multiple experience summary' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateMatchSummary(multiExpResumeJSON, mockJobText);

        expect(result).toBe('Multiple experience summary');
      });

      it('should handle empty skills array', async () => {
        const noSkillsResumeJSON = { ...mockResumeJSON, skills: [] };
        
        const mockResponse = {
          choices: [{ message: { content: 'No matching skills found' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateMatchSummary(noSkillsResumeJSON, mockJobText);

        expect(result).toBe('No matching skills found');
      });

      it('should trim whitespace from response', async () => {
        const mockResponse = {
          choices: [{ message: { content: '   Summary with spaces   ' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateMatchSummary(mockResumeJSON, mockJobText);

        expect(result).toBe('Summary with spaces');
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error when OpenAI API fails', async () => {
        mockCreate.mockRejectedValue(new Error('OpenAI API Error'));

        await expect(
          generateMatchSummary(mockResumeJSON, mockJobText)
        ).rejects.toThrow('OpenAI API Error');
      });

      it('should throw error when response is malformed', async () => {
        mockCreate.mockResolvedValue({ choices: [] });

        await expect(
          generateMatchSummary(mockResumeJSON, mockJobText)
        ).rejects.toThrow();
      });

      it('should handle API rate limit errors', async () => {
        mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

        await expect(
          generateMatchSummary(mockResumeJSON, mockJobText)
        ).rejects.toThrow('Rate limit exceeded');
      });

      it('should handle network timeout errors', async () => {
        mockCreate.mockRejectedValue(new Error('Network timeout'));

        await expect(
          generateMatchSummary(mockResumeJSON, mockJobText)
        ).rejects.toThrow('Network timeout');
      });
    });
  });


  describe('generatePortfolioJSON', () => {
    const mockResumeText = `
      JOHN DOE
      Project Manager
      john.doe@example.com | 555-1234 | San Francisco, CA
      
      SKILLS
      - Agile & Scrum
      - Team Leadership
      
      EXPERIENCE
      Senior Project Manager | Tech Corp | 2020-2023
      
      EDUCATION
      MBA | Stanford University | 2020
    `;

    describe('✅ Success Cases', () => {
      it('should generate portfolio JSON from resume', async () => {
        const mockPortfolioJSON = {
          name: 'John Doe',
          title: 'Project Manager',
          email: 'john.doe@example.com',
          phone: '555-1234',
          location: 'San Francisco, CA',
          skills: ['Agile & Scrum', 'Team Leadership'],
          experiences: [
            {
              company: 'Tech Corp',
              title: 'Senior Project Manager',
              startDate: '2020-01-01',
              endDate: '2023-12-31',
            },
          ],
          education: [],
          projects: [],
          socialLinks: {},
        };

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify(mockPortfolioJSON),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const result = await generatePortfolioJSON(mockResumeText);

        expect(mockCreate).toHaveBeenCalledWith({
          model: 'gpt-4o-mini',
          messages: expect.any(Array),
          temperature: 0.3,
          max_tokens: 2000,
        });
        expect(result).toBe(JSON.stringify(mockPortfolioJSON));
      });

      it('should replace email when provided', async () => {
        const newEmail = 'newemail@example.com';
        
        const mockResponse = {
          choices: [{ message: { content: '{}' } }],
        };

        mockCreate.mockResolvedValue(mockResponse);

        await generatePortfolioJSON(mockResumeText, newEmail);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain(
          `also replace email with ${newEmail}`
        );
      });

      it('should handle resume without email parameter', async () => {
        const mockResponse = {
          choices: [{ message: { content: '{}' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        await generatePortfolioJSON(mockResumeText);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).not.toContain('also replace email');
      });

      it('should include schema in prompt', async () => {
        const mockResponse = {
          choices: [{ message: { content: '{}' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        await generatePortfolioJSON(mockResumeText);

        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain('name');
        expect(callArgs.messages[0].content).toContain('skills');
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error when OpenAI API fails', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));

        await expect(generatePortfolioJSON(mockResumeText)).rejects.toThrow(
          'API Error'
        );
      });

      it('should handle empty resume text', async () => {
        const mockResponse = {
          choices: [{ message: { content: '{}' } }],
        };
        mockCreate.mockResolvedValue(mockResponse);

        const result = await generatePortfolioJSON('');

        expect(result).toBe('{}');
      });
    });
  });


  describe('generateVendorAboutAndMenuJSON', () => {
    const mockVendorText = `
      Vendor Name: Best Pizza
      Email: info@bestpizza.com
      Phone: 555-1234
      Business Type: Restaurant
    `;

    describe('✅ Success Cases', () => {
      it('should generate vendor JSON successfully', async () => {
        const mockVendorJSON = {
          vendor: {
            name: 'Best Pizza',
            email: 'info@bestpizza.com',
            phone: '555-1234',
            businessType: 'Restaurant',
            description: '',
            logo: '',
          },
          about: {
            banner: { image: '', title: '', description: '', shape: 'fullscreen' },
            contentBlocks: [],
            gridImages: [],
          },
          menuItems: [],
        };

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify(mockVendorJSON),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateVendorAboutAndMenuJSON(mockVendorText);

        expect(mockCreate).toHaveBeenCalledWith({
          model: 'gpt-4o-mini',
          messages: expect.any(Array),
          temperature: 0.3,
          max_tokens: 2000,
        });
        expect(result).toEqual(mockVendorJSON);
      });

      it('should parse JSON response correctly', async () => {
        const mockVendorJSON = {
          vendor: { name: 'Test' },
          about: {
            banner: { image: '', title: '', description: '', shape: 'fullscreen' },
            contentBlocks: [],
            gridImages: [],
          },
          menuItems: [],
        };

        const mockResponse = {
          choices: [{ message: { content: JSON.stringify(mockVendorJSON) } }],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateVendorAboutAndMenuJSON(mockVendorText);

        expect(result).toEqual(mockVendorJSON);
        expect(typeof result).toBe('object');
      });

      it('should handle vendor with menu items', async () => {
        const mockVendorJSON = {
          vendor: { name: 'Test' },
          about: {
            banner: { image: '', title: '', description: '', shape: 'fullscreen' },
            contentBlocks: [],
            gridImages: [],
          },
          menuItems: [
            { name: 'Pizza', price: 12.99, category: 'Food' },
          ],
        };

        const mockResponse = {
          choices: [{ message: { content: JSON.stringify(mockVendorJSON) } }],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateVendorAboutAndMenuJSON(mockVendorText);

        expect(result.menuItems).toHaveLength(1);
      });

      it('should handle vendor with empty menu', async () => {
        const mockVendorJSON = {
          vendor: { name: 'Test' },
          about: {
            banner: { image: '', title: '', description: '', shape: 'fullscreen' },
            contentBlocks: [],
            gridImages: [],
          },
          menuItems: [],
        };

        const mockResponse = {
          choices: [{ message: { content: JSON.stringify(mockVendorJSON) } }],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const result = await generateVendorAboutAndMenuJSON(mockVendorText);

        expect(result.menuItems).toEqual([]);
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error when OpenAI API fails', async () => {
        mockCreate.mockRejectedValue(new Error('API Error'));

        await expect(
          generateVendorAboutAndMenuJSON(mockVendorText)
        ).rejects.toThrow('API Error');
      });

      it('should throw error when JSON parsing fails', async () => {
        const mockResponse = {
          choices: [{ message: { content: 'Invalid JSON' } }],
        };

        mockCreate.mockResolvedValue(mockResponse);

        await expect(
          generateVendorAboutAndMenuJSON(mockVendorText)
        ).rejects.toThrow();
      });

      it('should handle empty response', async () => {
        const mockResponse = {
          choices: [{ message: { content: '' } }],
        };

        mockCreate.mockResolvedValue(mockResponse);

        await expect(
          generateVendorAboutAndMenuJSON(mockVendorText)
        ).rejects.toThrow();
      });

      it('should handle missing choices array', async () => {
        const mockResponse = { choices: [] };

        mockCreate.mockResolvedValue(mockResponse);

        await expect(
          generateVendorAboutAndMenuJSON(mockVendorText)
        ).rejects.toThrow();
      });
    });
  });


  describe('OpenAI Configuration', () => {
    it('should use gpt-4o-mini model for all functions', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'test' } }],
      };
      mockCreate.mockResolvedValue(mockResponse);

      await generateMatchSummary({}, 'test');
      expect(mockCreate.mock.calls[0][0].model).toBe('gpt-4o-mini');
    });

    it('should use temperature 0.3', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'test' } }],
      };
      mockCreate.mockResolvedValue(mockResponse);

      await generateMatchSummary({}, 'test');
      expect(mockCreate.mock.calls[0][0].temperature).toBe(0.3);
    });

    it('should use max_tokens 300 for match summary', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'test' } }],
      };
      mockCreate.mockResolvedValue(mockResponse);

      await generateMatchSummary({}, 'test');
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(300);
    });

    it('should use max_tokens 2000 for portfolio and vendor generation', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{}' } }],
      };
      mockCreate.mockResolvedValue(mockResponse);

      await generatePortfolioJSON('test');
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(2000);
    });
  });
});