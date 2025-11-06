import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle,
  Users,
  FolderOpen,
  CheckSquare,
  Building2,
  Zap,
  Shield,
  BarChart3,
  Clock,
  Globe,
  Star,
} from 'lucide-react';

export function LandingPage() {
  const features = [
    {
      icon: FolderOpen,
      title: 'Project Management',
      description: 'Track projects from initiation to closure with comprehensive workflow management.',
    },
    {
      icon: CheckSquare,
      title: 'Task Management',
      description: 'Organize tasks with kanban boards, stages, and priorities for maximum productivity.',
    },
    {
      icon: Building2,
      title: 'Business Units',
      description: 'Manage organizational hierarchy across departments, divisions, and corporate levels.',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Coordinate teams, assign roles, and manage employee responsibilities seamlessly.',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Role-based access control (RBAC) with granular permissions for every entity.',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Generate insights with comprehensive reporting and data visualization tools.',
    },
  ];

  const plans = [
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      description: 'Perfect for small teams getting started',
      features: [
        '5 Projects',
        '50 Tasks',
        '5 Team Members',
        'Basic Reports',
        'Email Support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$99',
      period: '/month',
      description: 'For growing teams with advanced needs',
      features: [
        'Unlimited Projects',
        'Unlimited Tasks',
        '25 Team Members',
        'Advanced Analytics',
        'Priority Support',
        'Custom Workflows',
        'API Access',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations with custom requirements',
      features: [
        'Everything in Professional',
        'Unlimited Team Members',
        'Dedicated Account Manager',
        '24/7 Phone Support',
        'Custom Integrations',
        'SLA Guarantee',
        'On-Premise Deployment',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: 'Sarah Thompson',
      role: 'Operations Director',
      company: 'Thompson Family Residence',
      image: null,
      quote: 'This platform transformed how we manage our home services operations. The project tracking and team coordination features are exceptional.',
      rating: 5,
    },
    {
      name: 'David Chen',
      role: 'Estate Manager',
      company: 'The Chen Estate',
      image: null,
      quote: 'We\'ve seen a 40% improvement in project delivery times since implementing this PMO solution. The RBAC system gives us perfect control.',
      rating: 5,
    },
    {
      name: 'Jennifer Walsh',
      role: 'Facilities Manager',
      company: 'Square One Shopping Centre',
      image: null,
      quote: 'Managing multiple locations and contractors has never been easier. The business unit hierarchy and task management are game-changers.',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-dark-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-100/90 backdrop-blur-md border-b border-dark-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-dark-600">Huron PMO</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-dark-700 hover:text-dark-600 transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-dark-700 hover:text-dark-600 transition-colors">
                Pricing
              </a>
              <a href="#testimonials" className="text-dark-700 hover:text-dark-600 transition-colors">
                Testimonials
              </a>
              <Link
                to="/login"
                className="text-dark-700 hover:text-dark-600 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm hover:shadow-md"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-dark-100 via-dark-100 to-dark-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-slate-100 to-dark-50 rounded-full text-slate-700 text-sm font-medium mb-6 border border-slate-200">
              <Zap className="h-4 w-4 mr-2 text-slate-600" />
              Trusted by Canadian Home Service Professionals
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-dark-600 mb-6 leading-tight">
              Run Your Home Services
              <br />
              Business{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-800">
                Like a Pro
              </span>
            </h1>
            <p className="text-xl text-dark-700 mb-10 max-w-3xl mx-auto leading-relaxed">
              Everything you need to manage projects, teams, customers, and operations in one powerful platform.
              No more juggling between spreadsheets, emails, and sticky notes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg hover:shadow-xl"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center px-8 py-4 border border-dark-400 text-base font-medium rounded-lg text-dark-600 bg-dark-100 hover:bg-dark-100 transition-all shadow-sm hover:shadow-md"
              >
                Learn More
              </a>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-dark-700">
              <div className="flex items-center bg-white/50 px-4 py-2 rounded-lg border border-dark-200">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">14-day free trial</span>
              </div>
              <div className="flex items-center bg-white/50 px-4 py-2 rounded-lg border border-dark-200">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">No credit card required</span>
              </div>
              <div className="flex items-center bg-white/50 px-4 py-2 rounded-lg border border-dark-200">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">Setup in 5 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-dark-100 border-y border-dark-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-700">98%</div>
              <div className="text-dark-700 mt-2">Customer Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-700">50K+</div>
              <div className="text-dark-700 mt-2">Projects Completed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-700">500+</div>
              <div className="text-dark-700 mt-2">Organizations</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-700">24/7</div>
              <div className="text-dark-700 mt-2">Support Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Everything You Need in One Place
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              From project planning to customer invoicing, Huron PMO brings all your business operations
              together in one intuitive platform.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-dark-100 p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-dark-300"
              >
                <div className="h-12 w-12 bg-gradient-to-r from-slate-300 to-dark-50 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-slate-700" />
                </div>
                <h3 className="text-xl font-semibold text-dark-600 mb-2">{feature.title}</h3>
                <p className="text-dark-700">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Pricing That Grows With You
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees, no surprises.
              Cancel anytime with no questions asked.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-dark-100 rounded-2xl shadow-lg border-2 p-8 ${
                  plan.popular
                    ? 'border-dark-400 ring-4 ring-slate-100'
                    : 'border-dark-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-dark-600 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-dark-600">{plan.price}</span>
                    <span className="text-dark-700">{plan.period}</span>
                  </div>
                  <p className="text-dark-700">{plan.description}</p>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-dark-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block w-full text-center px-6 py-3 rounded-lg font-medium transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800 shadow-md hover:shadow-lg'
                      : 'bg-dark-100 text-dark-600 hover:bg-dark-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Loved by Home Service Professionals
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              Don't just take our word for it. Here's what real customers say about using Huron PMO
              to transform their business operations.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-dark-100 p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-dark-300"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-dark-600 mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center">
                  <div className="h-12 w-12 bg-gradient-to-r from-slate-400 to-dark-100 rounded-full flex items-center justify-center mr-4">
                    <Users className="h-6 w-6 text-slate-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-dark-600">{testimonial.name}</div>
                    <div className="text-sm text-dark-700">{testimonial.role}</div>
                    <div className="text-sm text-dark-700">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-slate-700 to-dark-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-xl text-dark-600 mb-10">
            Join hundreds of organizations already using Huron PMO to streamline their project management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-slate-700 bg-dark-100 hover:bg-dark-100 transition-all shadow-lg hover:shadow-xl"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-white bg-transparent hover:bg-dark-100/10 transition-all"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-900 text-dark-600 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="h-8 w-8 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-white">Huron PMO</span>
              </div>
              <p className="text-sm">
                Enterprise-grade project and operations management for Canadian home services.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-dark-400 pt-8 text-center text-sm">
            <p>&copy; 2025 Huron Home Services. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
