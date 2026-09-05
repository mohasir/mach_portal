'use client';
import type { ReactNode } from 'react';
import { Flex } from 'antd';
import { Footer } from '@/components/shared/Footer';
import { Logo } from '@/components/shared/Logo';
import { WrapperCard } from '@/components/shared/WrapperCard';

export function AuthLayoutContainer({ children }: { children: ReactNode }) {
  return (
    <>
      <Flex justify="center" align="center" className="min-h-full bg-primary/5">
        <WrapperCard className="w-full max-w-90 ">
          <Flex justify="center" className="h-16 my-6">
            <Logo />
          </Flex>
          {children}
        </WrapperCard>
      </Flex>

      <Footer className="fixed inset-x-0 bottom-4" />
    </>
  );
}
