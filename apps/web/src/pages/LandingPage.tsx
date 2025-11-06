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
  Brain,
  Cpu,
  Network,
  Sparkles,
  Bot,
  Target,
  TrendingUp,
  Layers,
  Workflow,
  Eye,
  Lightbulb,
  Rocket,
  UserCircle,
  Briefcase,
  Code,
} from 'lucide-react';

export function LandingPage() {
  // Core Value Propositions
  const coreValues = [
    {
      icon: Brain,
      title: 'AI-First Automation',
      description: 'Leverage AI to automate tasks, workflows, and decisions across departments. Our platform learns how your teams operate and optimizes processes in real time.',
    },
    {
      icon: Workflow,
      title: 'Seamless Workflow Orchestration',
      description: 'Connect every system — CRM, HR, Finance, Support, Product — into a single cohesive workflow that evolves as your business does.',
    },
    {
      icon: Eye,
      title: 'Unified Customer 360 View',
      description: 'AI-powered 360° view of every customer. From first contact to long-term engagement, every touchpoint is visible, actionable, and personalized.',
    },
    {
      icon: Users,
      title: 'Human + AI Collaboration',
      description: 'We don\'t replace humans — we empower them. Automate what machines do best so your teams can focus on creativity, strategy, and success.',
    },
    {
      icon: Network,
      title: 'Cross-Department Intelligence',
      description: 'Reduce friction between teams and projects. AI-driven insights surface dependencies, anticipate bottlenecks, and recommend optimal next steps.',
    },
    {
      icon: Sparkles,
      title: 'Continuous Learning AI',
      description: 'The more you use it, the smarter your operations become. Our AI adapts to your business patterns and continuously improves efficiency.',
    },
  ];

  // Platform Capabilities
  const capabilities = [
    {
      icon: Bot,
      title: 'AI-Driven Workflow Builder',
      description: 'Automate and customize workflows with natural language. Simply describe what you need, and let AI build it.',
    },
    {
      icon: Target,
      title: 'Smart CRM Engine',
      description: 'Know your customers like never before through unified, contextual intelligence across every interaction.',
    },
    {
      icon: Zap,
      title: 'AI-Powered Service Desk',
      description: 'Automate customer service responses, routing, and follow-ups with human oversight when needed.',
    },
    {
      icon: BarChart3,
      title: 'Operational Intelligence Hub',
      description: 'Gain a real-time view of every process across departments with predictive analytics and insights.',
    },
    {
      icon: Layers,
      title: 'Data & Integration Layer',
      description: 'Connect to your tools — Slack, Salesforce, Notion, Jira, HubSpot, and more — seamlessly.',
    },
    {
      icon: TrendingUp,
      title: 'Continuous Learning AI',
      description: 'Your operations become smarter over time as AI learns from patterns and optimizes automatically.',
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
      role: 'Chief Operations Officer',
      company: 'TechVenture Inc.',
      image: null,
      quote: 'OperationOS transformed our workflow chaos into an intelligent, self-optimizing system. AI automation has freed our teams to focus on innovation.',
      rating: 5,
    },
    {
      name: 'David Chen',
      role: 'VP of Customer Success',
      company: 'CloudScale Solutions',
      image: null,
      quote: 'The 360° customer view powered by AI is game-changing. We\'ve increased customer satisfaction by 45% and reduced response times by 60%.',
      rating: 5,
    },
    {
      name: 'Jennifer Walsh',
      role: 'Director of Operations',
      company: 'Enterprise Dynamics',
      image: null,
      quote: 'Cross-department collaboration has never been easier. OperationOS surfaced bottlenecks we didn\'t even know existed and automated them away.',
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
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-dark-600">OperationOS</span>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#vision" className="text-dark-700 hover:text-dark-600 transition-colors">
                Vision
              </a>
              <a href="#capabilities" className="text-dark-700 hover:text-dark-600 transition-colors">
                Capabilities
              </a>
              <a href="#pricing" className="text-dark-700 hover:text-dark-600 transition-colors">
                Pricing
              </a>
              <Link
                to="/login"
                className="text-dark-700 hover:text-dark-600 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 transition-all shadow-sm hover:shadow-md"
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
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full text-blue-700 text-sm font-medium mb-6 border border-blue-200">
              <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
              AI-First Operations Platform
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-dark-600 mb-6 leading-tight">
              Reimagine Operations with
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">
                AI-First Intelligence
              </span>
            </h1>
            <p className="text-xl text-dark-700 mb-10 max-w-3xl mx-auto leading-relaxed">
              Automate, orchestrate, and elevate your organization's workflows with an AI-first Operations OS —
              where human insight meets autonomous efficiency.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a
                href="#vision"
                className="inline-flex items-center justify-center px-8 py-4 border border-dark-400 text-base font-medium rounded-lg text-dark-600 bg-dark-100 hover:bg-dark-100 transition-all shadow-sm hover:shadow-md"
              >
                Book a Demo
              </a>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-dark-700">
              <div className="flex items-center bg-white/50 px-4 py-2 rounded-lg border border-dark-200">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">AI-powered automation</span>
              </div>
              <div className="flex items-center bg-white/50 px-4 py-2 rounded-lg border border-dark-200">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">Seamless integrations</span>
              </div>
              <div className="flex items-center bg-white/50 px-4 py-2 rounded-lg border border-dark-200">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">Enterprise-grade security</span>
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
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">75%</div>
              <div className="text-dark-700 mt-2">Time Saved via AI</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">10M+</div>
              <div className="text-dark-700 mt-2">Tasks Automated</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">2500+</div>
              <div className="text-dark-700 mt-2">Organizations</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">99.9%</div>
              <div className="text-dark-700 mt-2">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section id="vision" className="py-20 bg-gradient-to-br from-dark-100 to-dark-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full text-purple-700 text-sm font-medium mb-6 border border-purple-200">
              <Lightbulb className="h-4 w-4 mr-2" />
              Our Vision
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-6">
              The Future of Work is <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">AI-First</span>
            </h2>
            <div className="max-w-4xl mx-auto space-y-6 text-lg text-dark-700 leading-relaxed">
              <p>
                Every business runs on operations — but traditional systems are built around manual workflows,
                data silos, and fragmented communication. OperationOS is designed to change that.
              </p>
              <p>
                We build <strong className="text-dark-600">AI-first automation and collaboration layers</strong> across
                your business ecosystem, connecting teams, data, and processes into one intelligent operational fabric.
                With OperationOS, your organization doesn't just manage operations — it <strong className="text-dark-600">automates,
                learns, and adapts continuously</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Value Propositions */}
      <section className="py-20 bg-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Core Value Proposition
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              Transform your operations with AI-powered intelligence that works for you 24/7.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreValues.map((value, index) => (
              <div
                key={index}
                className="bg-dark-100 p-8 rounded-xl shadow-sm hover:shadow-lg transition-all border border-dark-300 hover:border-purple-300"
              >
                <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                  <value.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-dark-600 mb-2">{value.title}</h3>
                <p className="text-dark-700">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section id="capabilities" className="py-20 bg-gradient-to-br from-dark-100 to-dark-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Platform Capabilities
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              Everything you need to build, automate, and scale your operations — all in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capabilities.map((capability, index) => (
              <div
                key={index}
                className="bg-dark-100 p-8 rounded-xl shadow-sm hover:shadow-md transition-all border border-dark-300"
              >
                <div className="h-12 w-12 bg-gradient-to-r from-purple-400 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                  <capability.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-dark-600 mb-2">{capability.title}</h3>
                <p className="text-dark-700">{capability.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why OperationOS */}
      <section className="py-20 bg-dark-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Why OperationOS?
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-dark-100 rounded-xl border border-dark-300 hover:border-blue-400 transition-all">
              <div className="inline-flex h-16 w-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full items-center justify-center mb-6">
                <Cpu className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-dark-600 mb-3">AI-First by Design</h3>
              <p className="text-dark-700">
                Unlike legacy tools that bolt on AI, OperationOS is built AI-first from the ground up,
                enabling proactive, predictive, and adaptive automation.
              </p>
            </div>
            <div className="text-center p-8 bg-dark-100 rounded-xl border border-dark-300 hover:border-purple-400 transition-all">
              <div className="inline-flex h-16 w-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full items-center justify-center mb-6">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-dark-600 mb-3">Designed for Workforce Productivity</h3>
              <p className="text-dark-700">
                Empower your teams to do more with less — by automating workflows, surfacing insights,
                and enabling focus on high-impact work.
              </p>
            </div>
            <div className="text-center p-8 bg-dark-100 rounded-xl border border-dark-300 hover:border-indigo-400 transition-all">
              <div className="inline-flex h-16 w-16 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-dark-600 mb-3">Enterprise-Grade Simplicity</h3>
              <p className="text-dark-700">
                Secure, scalable, and intuitive. Built for organizations that want to innovate fast without complexity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="py-20 bg-gradient-to-br from-dark-100 to-dark-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-4">
              Who We Serve
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              From customer service to sales, operations to product teams — OperationOS powers every department.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-dark-100 p-6 rounded-xl border border-dark-300 hover:border-blue-400 transition-all text-center">
              <UserCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-dark-600 mb-2">Customer Service Teams</h3>
              <p className="text-sm text-dark-700">Transform service ops with autonomous workflows and AI insights.</p>
            </div>
            <div className="bg-dark-100 p-6 rounded-xl border border-dark-300 hover:border-purple-400 transition-all text-center">
              <Target className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-dark-600 mb-2">Sales & CRM Leaders</h3>
              <p className="text-sm text-dark-700">Build adaptive customer journeys with full context.</p>
            </div>
            <div className="bg-dark-100 p-6 rounded-xl border border-dark-300 hover:border-indigo-400 transition-all text-center">
              <Briefcase className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-dark-600 mb-2">Operations & Strategy Teams</h3>
              <p className="text-sm text-dark-700">Gain end-to-end visibility and decision intelligence.</p>
            </div>
            <div className="bg-dark-100 p-6 rounded-xl border border-dark-300 hover:border-cyan-400 transition-all text-center">
              <Code className="h-12 w-12 text-cyan-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-dark-600 mb-2">Tech & Product Teams</h3>
              <p className="text-sm text-dark-700">Reduce silos between projects and streamline releases.</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI-First Future */}
      <section className="py-20 bg-dark-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full text-purple-700 text-sm font-medium mb-6 border border-purple-200">
            <Sparkles className="h-4 w-4 mr-2" />
            The Future is Here
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-dark-600 mb-6">
            The AI-First Future of Operations
          </h2>
          <p className="text-xl text-dark-700 mb-8 leading-relaxed">
            The next generation of enterprise software isn't about managing data — it's about
            <strong className="text-dark-600"> activating intelligence</strong>.
          </p>
          <p className="text-lg text-dark-700 mb-10 leading-relaxed">
            With OperationOS, every workflow becomes a <strong className="text-dark-600">smart workflow</strong>,
            every process a <strong className="text-dark-600">self-optimizing system</strong>, and every human
            a <strong className="text-dark-600">more capable contributor</strong>.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-dark-100 to-dark-200">
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
                    ? 'border-purple-400 ring-4 ring-purple-100'
                    : 'border-dark-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-4 py-1 rounded-full text-sm font-medium">
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
                      ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white hover:from-blue-700 hover:to-purple-800 shadow-md hover:shadow-lg'
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
              Trusted by Leading Operations Teams
            </h2>
            <p className="text-xl text-dark-700 max-w-2xl mx-auto">
              See how organizations are transforming their operations with AI-first intelligence.
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
      <section className="py-20 bg-gradient-to-r from-blue-700 via-purple-700 to-indigo-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Let's Redefine How Your Organization Works
          </h2>
          <p className="text-xl text-blue-50 mb-10">
            Experience AI-first operations today. Transform your workflows, empower your teams, and unlock unprecedented efficiency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-purple-700 bg-white hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-white bg-transparent hover:bg-white/10 transition-all"
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
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-700 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-white">OperationOS</span>
              </div>
              <p className="text-sm">
                AI-first operations platform for modern enterprises. Automate, orchestrate, and elevate your workflows.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#vision" className="hover:text-white transition-colors">Vision</a></li>
                <li><a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/signup" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-dark-400 pt-8 text-center text-sm">
            <p>&copy; 2025 OperationOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
