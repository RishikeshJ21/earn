import { CheckIcon } from '@chakra-ui/icons';
import {
  Button,
  Flex,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Progress,
  Stepper,
  Text,
  useSteps,
  VStack,
} from '@chakra-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type GrantApplication } from '@prisma/client';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Form } from '@/components/ui/form';
import { FormFieldWrapper } from '@/components/ui/form-field-wrapper';
import { Input } from '@/components/ui/input';
import { extractTwitterUsername, Twitter } from '@/features/talent';
import { useUpdateUser, useUser } from '@/store/user';
import { cn } from '@/utils';
import { dayjs } from '@/utils/dayjs';

import { userApplicationQuery } from '../queries';
import { type Grant } from '../types';
import { grantApplicationSchema } from '../utils/grantApplicationSchema';

const steps = [
  { title: 'Basics' },
  { title: 'Details' },
  { title: 'Milestones' },
];

interface EligibilityAnswer {
  question: string;
  answer: string;
}

interface GrantApplicationForm {
  projectTitle: string;
  projectOneLiner: string;
  ask: number;
  walletAddress: string;
  projectDetails: string;
  projectTimeline: string;
  proofOfWork: string;
  milestones: string;
  kpi: string;
  twitter: string;
  [key: string]: string | number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grant: Grant;
  grantApplication?: GrantApplication;
}

export const GrantApplicationModal = ({
  isOpen,
  onClose,
  grant,
  grantApplication,
}: Props) => {
  const { id, token, minReward, maxReward, questions } = grant;

  const { user, refetchUser } = useUser();

  const updateUser = useUpdateUser();

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: steps.length,
  });

  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<GrantApplicationForm>({
    resolver: zodResolver(
      grantApplicationSchema(
        minReward || 0,
        maxReward || 0,
        token || 'USDC',
        grant.questions,
      ),
    ),
    defaultValues: {
      projectTitle: grantApplication?.projectTitle || '',
      projectOneLiner: grantApplication?.projectOneLiner || '',
      ask: grantApplication?.ask || undefined,
      walletAddress: grantApplication?.walletAddress || user?.publicKey || '',
      projectDetails: grantApplication?.projectDetails || '',
      projectTimeline: grantApplication?.projectTimeline
        ? dayjs(grantApplication?.projectTimeline, 'D MMMM YYYY').format(
            'YYYY-MM-DD',
          )
        : '',
      proofOfWork: grantApplication?.proofOfWork || '',
      milestones: grantApplication?.milestones || '',
      kpi: grantApplication?.kpi || '',
      twitter: grantApplication?.twitter
        ? extractTwitterUsername(grantApplication?.twitter) || ''
        : extractTwitterUsername(user?.twitter || '') || '',
      ...(grantApplication?.answers
        ? Object.fromEntries(
            (grantApplication.answers as unknown as EligibilityAnswer[]).map(
              (answer, index) => [`answer-${index + 1}`, answer.answer],
            ),
          )
        : {}),
    },
  });

  const queryClient = useQueryClient();

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.publicKey) form.setValue('publicKey', user?.publicKey);
  }, [user]);

  const submitApplication = async (data: any) => {
    setIsLoading(true);
    try {
      const {
        projectTitle,
        projectOneLiner,
        ask,
        walletAddress,
        projectDetails,
        projectTimeline,
        proofOfWork,
        milestones,
        kpi,
        twitter,
        ...answers
      } = data;

      await updateUser.mutateAsync({ publicKey: walletAddress });

      const grantAnswers =
        questions?.map((q: any) => ({
          question: q.question,
          answer: answers[`answer-${q.order}`],
        })) ?? [];

      const apiAction = !!grantApplication ? 'update' : 'create';

      await axios.post(`/api/grant-application/${apiAction}/`, {
        grantId: id,
        projectTitle,
        projectOneLiner,
        projectDetails,
        projectTimeline,
        proofOfWork,
        milestones,
        kpi,
        walletAddress,
        ask: ask || null,
        twitter,
        answers: grantAnswers.length ? grantAnswers : [],
      });

      form.reset();
      await queryClient.invalidateQueries({
        queryKey: userApplicationQuery(id).queryKey,
      });

      await refetchUser();

      toast.success(
        grantApplication
          ? 'Application updated successfully!'
          : 'Application submitted successfully!',
      );

      onClose();
    } catch (e) {
      setIsLoading(false);
      toast.error('Failed to submit application', {
        description:
          'Please try again later or contact support if the issue persists.',
      });
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    const fieldsToValidate = {
      0: ['projectTitle', 'projectOneLiner', 'walletAddress'],
      1: [
        'projectDetails',
        'projectTimeline',
        'proofOfWork',
        'twitter',
        ...(questions?.map((q: any) => `answer-${q.order}`) || []),
      ],
      2: ['milestones', 'kpi'],
    };

    form
      .trigger(fieldsToValidate[activeStep as keyof typeof fieldsToValidate])
      .then((isValid) => {
        if (isValid) {
          setActiveStep((prev) => prev + 1);
          if (modalRef.current) {
            modalRef.current.scrollTop = 0;
          }
        }
      });
  };
  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  };

  const date = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    console.log(form.formState.errors);
  }, [form.formState.errors]);

  return (
    <Modal
      closeOnOverlayClick={false}
      isCentered
      isOpen={isOpen}
      onClose={onClose}
      scrollBehavior={'inside'}
      size={'xl'}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader px={{ base: 4, md: 10 }} pt={8} color="brand.slate.800">
          Grant Application
          <Text mt={1} color={'brand.slate.500'} fontSize="sm" fontWeight={400}>
            If you&apos;re working on a project that will help the
            sponsor&apos;s ecosystem grow, apply with your proposal here and
            we&apos;ll respond soon!
          </Text>
          <Progress
            h={'1.5px'}
            mx={-3}
            mt={6}
            borderRadius={2}
            bgColor={'brand.slate.200'}
            value={(activeStep / steps.length) * 100 + 33}
          />
          <Stepper w="100%" mt={3} index={activeStep}>
            {steps.map((step, i) => (
              <Flex key={i} align={'center'} gap={1.5} fontWeight={400}>
                <Text
                  align={'center'}
                  verticalAlign={'middle'}
                  w="6"
                  h="6"
                  color={
                    i - 1 < activeStep ? 'brand.slate.500' : 'brand.slate.400'
                  }
                  fontWeight={i - 1 < activeStep ? 500 : 400}
                  borderWidth={'1px'}
                  borderColor={
                    i < activeStep
                      ? 'transparent'
                      : i - 1 < activeStep
                        ? 'brand.slate.500'
                        : 'brand.slate.300'
                  }
                  borderRadius={'full'}
                  bgColor={i < activeStep ? 'brand.purple' : 'transparent'}
                  style={{
                    fontSize: '14px',
                  }}
                >
                  {i < activeStep ? (
                    <CheckIcon color="white" boxSize={2.5} />
                  ) : (
                    i + 1
                  )}
                </Text>
                <Text
                  color={
                    i - 1 < activeStep ? 'brand.slate.600' : 'brand.slate.500'
                  }
                  fontSize={'md'}
                  fontWeight={i - 1 < activeStep ? 500 : 400}
                >
                  {step.title}
                </Text>
              </Flex>
            ))}
          </Stepper>
        </ModalHeader>
        <ModalCloseButton mt={5} />
        <VStack
          ref={modalRef}
          align={'start'}
          gap={3}
          overflowY={'auto'}
          maxH={'50rem'}
          px={{ base: 4, md: 10 }}
          pb={10}
        >
          <Form {...form}>
            <form
              style={{ width: '100%' }}
              onSubmit={form.handleSubmit((data) => {
                if (activeStep === steps.length - 1) {
                  submitApplication(data);
                }
              })}
            >
              {activeStep === 0 && (
                <VStack gap={4} mb={5}>
                  <FormFieldWrapper
                    control={form.control}
                    name="projectTitle"
                    label="Project Title"
                    description="What should we call your project?"
                    isRequired
                  >
                    <Input placeholder="Project Title" />
                  </FormFieldWrapper>

                  <FormFieldWrapper
                    control={form.control}
                    name="projectOneLiner"
                    label="One-Liner Description"
                    description="Describe your idea in one sentence."
                    isRequired
                  >
                    <Input placeholder="Sum up your project in one sentence" />
                  </FormFieldWrapper>

                  <FormFieldWrapper
                    control={form.control}
                    name="ask"
                    label="What's the compensation you require to complete this fully?"
                    isRequired
                    isTokenInput
                    token={token}
                  />

                  <FormFieldWrapper
                    control={form.control}
                    name="walletAddress"
                    label="Your Solana Wallet Address"
                    description={
                      <>
                        This is where you will receive your rewards if you win.
                        If you want to edit it,{' '}
                        <a
                          href={`/t/${user?.username}/edit`}
                          className="text-blue-600 underline hover:text-blue-700"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          click here
                        </a>
                      </>
                    }
                  >
                    <Input
                      className="cursor-not-allowed text-slate-600 opacity-80"
                      placeholder="Add your Solana wallet address"
                      readOnly
                    />
                  </FormFieldWrapper>
                </VStack>
              )}
              {activeStep === 1 && (
                <VStack gap={4} mb={5}>
                  <FormFieldWrapper
                    control={form.control}
                    name="projectDetails"
                    label="Project Details"
                    description="What is the problem you're trying to solve, and how you're going to solve it?"
                    isRequired
                    isRichEditor
                    richEditorPlaceholder="Explain the problem you're solving and your solution"
                  />

                  <FormFieldWrapper
                    control={form.control}
                    name="projectTimeline"
                    label={`Deadline (in ${Intl.DateTimeFormat().resolvedOptions().timeZone})`}
                    description="What is the expected completion date for the project?"
                    isRequired
                  >
                    <Input
                      className={cn(
                        'relative w-full',
                        '[&::-webkit-calendar-picker-indicator]:opacity-0',
                        '[&::-webkit-calendar-picker-indicator]:absolute',
                        '[&::-webkit-calendar-picker-indicator]:inset-0',
                        '[&::-webkit-calendar-picker-indicator]:w-full',
                        '[&::-webkit-calendar-picker-indicator]:h-full',
                        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
                      )}
                      min={date}
                      placeholder="deadline"
                      type="date"
                    />
                  </FormFieldWrapper>

                  <FormFieldWrapper
                    control={form.control}
                    name="proofOfWork"
                    label="Proof of Work"
                    description="Include links to your best work that will make the community trust you to execute on this project."
                    isRequired
                    isRichEditor
                    richEditorPlaceholder="Provide links to your portfolio or previous work"
                  />

                  <FormFieldWrapper
                    control={form.control}
                    name="twitter"
                    label="Personal Twitter Profile"
                    description="Add your personal Twitter username"
                    isRequired
                  >
                    <div className="mb-5 flex items-center">
                      <div className="relative flex items-center">
                        <Twitter className="mr-3 h-5 w-5 text-slate-600" />
                      </div>
                      <div className="flex h-9 items-center rounded-l-md border border-r-0 border-input px-3">
                        <span className="text-sm font-medium text-slate-600 md:text-[0.875rem]">
                          x.com/
                        </span>
                      </div>
                      <Input
                        className="rounded-l-none"
                        defaultValue={
                          extractTwitterUsername(user?.twitter || '') ||
                          undefined
                        }
                        placeholder="johncena"
                      />
                    </div>
                  </FormFieldWrapper>

                  {questions?.map((question: any) => (
                    <FormFieldWrapper
                      key={question.order}
                      control={form.control}
                      name={`answer-${question.order}`}
                      label={question.question}
                      isRequired
                      isRichEditor
                    />
                  ))}
                </VStack>
              )}
              {activeStep === 2 && (
                <VStack gap={4} mb={5}>
                  <FormFieldWrapper
                    control={form.control}
                    name="milestones"
                    label="Goals and Milestones"
                    description="List down the things you hope to achieve by the end of project duration."
                    isRequired
                    isRichEditor
                    richEditorPlaceholder="Outline your project goals and milestones"
                  />

                  <FormFieldWrapper
                    control={form.control}
                    name="kpi"
                    label="Primary Key Performance Indicator"
                    description="What metric will you track to indicate success/failure of the project? At what point will it be a success? Could be anything, e.g. installs, users, views, TVL, etc."
                    isRequired
                    isRichEditor
                    richEditorPlaceholder="What's the key metric for success"
                  />
                </VStack>
              )}
              <Flex gap={2} mt={8}>
                {activeStep > 0 && (
                  <Button
                    className="ph-no-capture"
                    w={'full'}
                    color="brand.slate.500"
                    onClick={handleBack}
                    variant="unstyled"
                  >
                    Back
                  </Button>
                )}
                {activeStep === steps.length - 1 ? (
                  <Button
                    className="ph-no-capture"
                    w={'full'}
                    isLoading={!!isLoading}
                    loadingText="Applying..."
                    type="submit"
                    variant="solid"
                  >
                    {!!grantApplication ? 'Update' : 'Apply'}
                  </Button>
                ) : (
                  <Button
                    className="ph-no-capture"
                    w={'full'}
                    onClick={handleNext}
                    type="button"
                    variant="solid"
                  >
                    Continue
                  </Button>
                )}
              </Flex>
            </form>
          </Form>
        </VStack>
      </ModalContent>
    </Modal>
  );
};
