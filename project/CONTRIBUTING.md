# Contributing to AuraSAFE

Thank you for your interest in contributing to AuraSAFE! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- Git
- Docker (optional but recommended)

### Development Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/aurasafe.git
cd aurasafe

# Run the setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## 🎯 How to Contribute

### 1. Fork the Repository
- Fork the project on GitHub
- Clone your fork locally
- Add the original repository as upstream

```bash
git remote add upstream https://github.com/yourusername/aurasafe.git
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Make Your Changes
- Follow our coding standards
- Add tests for new functionality
- Update documentation as needed

### 4. Test Your Changes
```bash
# Run all tests
npm test
cd backend && pytest

# Run linting
npm run lint
cd backend && flake8 .

# Test Docker build
docker-compose build
```

### 5. Commit Your Changes
We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new safety algorithm"
git commit -m "fix: resolve route calculation bug"
git commit -m "docs: update API documentation"
```

### 6. Push and Create Pull Request
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 📋 Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful variable and function names
- Add JSDoc comments for public APIs

### Python
- Follow PEP 8 style guide
- Use type hints
- Write docstrings for all functions and classes
- Use Black for formatting
- Maximum line length: 88 characters

### Git Commit Messages
- Use conventional commit format
- Keep first line under 50 characters
- Use imperative mood ("Add feature" not "Added feature")
- Reference issues and PRs when applicable

## 🧪 Testing Guidelines

### Frontend Testing
- Write unit tests for utilities and hooks
- Write integration tests for components
- Use React Testing Library
- Aim for >80% code coverage

### Backend Testing
- Write unit tests for all functions
- Write integration tests for API endpoints
- Use pytest fixtures for test data
- Mock external dependencies

### End-to-End Testing
- Test critical user journeys
- Test across different browsers
- Test mobile responsiveness

## 📚 Documentation

### Code Documentation
- Document all public APIs
- Include examples in documentation
- Keep README.md up to date
- Document configuration options

### API Documentation
- Use OpenAPI/Swagger specifications
- Include request/response examples
- Document error codes and messages

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, versions)
- Screenshots or logs if applicable

Use our bug report template:

```markdown
**Bug Description**
A clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g. iOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]
```

## 💡 Feature Requests

For feature requests, please:
- Check if the feature already exists
- Describe the use case clearly
- Explain why this feature would be valuable
- Consider implementation complexity

## 🔒 Security

### Reporting Security Issues
- **DO NOT** open public issues for security vulnerabilities
- Email security@aurasafe.app with details
- Include steps to reproduce if possible
- We'll respond within 48 hours

### Security Guidelines
- Never commit secrets or API keys
- Use environment variables for configuration
- Follow OWASP security guidelines
- Validate all user inputs
- Use HTTPS in production

## 📦 Release Process

### Version Numbering
We use [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Docker images built and tested
- [ ] Security scan completed

## 🏗️ Architecture Guidelines

### Frontend Architecture
- Use React functional components with hooks
- Implement proper error boundaries
- Use TypeScript for type safety
- Follow component composition patterns
- Implement proper loading and error states

### Backend Architecture
- Use FastAPI for REST APIs
- Implement proper error handling
- Use async/await for I/O operations
- Follow dependency injection patterns
- Implement proper logging

### Database Design
- Use proper indexing for performance
- Implement data validation
- Follow normalization principles
- Use migrations for schema changes
- Implement proper backup strategies

## 🎨 UI/UX Guidelines

### Design Principles
- Mobile-first responsive design
- Accessibility compliance (WCAG 2.1)
- Consistent color scheme and typography
- Intuitive navigation and user flows
- Fast loading times and smooth animations

### Component Guidelines
- Reusable and composable components
- Consistent prop interfaces
- Proper error and loading states
- Accessible markup and ARIA labels
- Responsive design patterns

## 🌍 Internationalization

### Adding New Languages
- Use i18n keys for all user-facing text
- Provide context for translators
- Test with longer text strings
- Consider RTL language support
- Update language selection UI

## 📊 Performance Guidelines

### Frontend Performance
- Optimize bundle size
- Implement code splitting
- Use lazy loading for routes
- Optimize images and assets
- Implement proper caching strategies

### Backend Performance
- Optimize database queries
- Implement proper caching
- Use connection pooling
- Monitor response times
- Implement rate limiting

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different opinions and approaches
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)

### Communication
- Use clear and concise language
- Be patient with questions
- Provide helpful feedback on PRs
- Share knowledge and best practices
- Participate in discussions constructively

## 📞 Getting Help

### Development Help
- Check existing documentation
- Search closed issues and PRs
- Ask questions in GitHub Discussions
- Join our Discord community
- Attend our weekly office hours

### Contact Information
- **General Questions**: hello@aurasafe.app
- **Technical Support**: support@aurasafe.app
- **Security Issues**: security@aurasafe.app
- **Discord**: [discord.gg/aurasafe](https://discord.gg/aurasafe)

## 🏆 Recognition

### Contributors
We recognize contributors in:
- README.md contributors section
- Release notes
- Annual contributor awards
- Conference speaking opportunities
- Open source badges and certificates

### Contribution Types
We value all types of contributions:
- Code contributions
- Documentation improvements
- Bug reports and testing
- Design and UX feedback
- Community support and mentoring
- Translation and localization

Thank you for contributing to AuraSAFE! Together, we're making urban environments safer for everyone. 🛡️